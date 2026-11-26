import { addDays, daysInMonth, daysUntil, periodOf, sum } from './logic';
import type { Bill, Data, Payment, Reading, Settings } from './types';

export interface PowerForecast {
  /** Average kWh used per day */
  perDay: number;
  /** Estimated kWh left on the meter today */
  remaining: number;
  daysLeft: number;
  runOutDate: string;
  basis: 'readings' | 'purchases';
  /** kWh bought so far this month (drives the tariff block) */
  monthKwh: number;
  /** kWh to buy so the meter lasts to the end of the month */
  toMonthEndKwh: number;
  toMonthEndCost: number;
  /** kWh to buy for 30 more days */
  for30DaysKwh: number;
  for30DaysCost: number;
}

const byDate = <T extends { date: string }>(xs: T[]) => [...xs].sort((a, b) => a.date.localeCompare(b.date));

/**
 * Average daily electricity use.
 * With 2+ meter readings: consumption between readings, counting purchases in between.
 * Otherwise from purchase history: kWh bought (except the latest purchase) over the time
 * from the first to the latest purchase – assumes you top up when units run low.
 */
export function dailyUse(purchases: Payment[], readings: Reading[], today: string): { perDay: number; basis: 'readings' | 'purchases' } | null {
  const since = addDays(today, -120);
  const ps = byDate(purchases.filter((p) => p.kwh && p.date >= since));
  const rs = byDate(readings.filter((r) => r.date >= since));
  if (rs.length >= 2) {
    const first = rs[0];
    const last = rs[rs.length - 1];
    const days = daysUntil(first.date, last.date);
    if (days >= 3) {
      const bought = sum(ps.filter((p) => p.date > first.date && p.date <= last.date).map((p) => p.kwh ?? 0));
      const used = first.value + bought - last.value;
      if (used > 0) return { perDay: used / days, basis: 'readings' };
    }
  }
  if (ps.length >= 2) {
    const days = daysUntil(ps[0].date, ps[ps.length - 1].date);
    if (days >= 3) {
      const used = sum(ps.slice(0, -1).map((p) => p.kwh ?? 0));
      return { perDay: used / days, basis: 'purchases' };
    }
  }
  return null;
}

/** Cost in RWF (incl. VAT) of buying `kwh` more units when `already` kWh were bought this month. */
export function tariffCost(tariff: Settings['tariff'], already: number, kwh: number): number {
  let cost = 0;
  let pos = already;
  let left = kwh;
  let lower = 0;
  for (const b of tariff.blocks) {
    const upper = b.upTo ?? Infinity;
    if (pos < upper && left > 0) {
      const start = Math.max(pos, lower);
      const take = Math.min(left, upper - start);
      cost += take * b.price;
      left -= take;
      pos = start + take;
    }
    lower = upper;
  }
  return cost * (1 + tariff.vatPct / 100);
}

/** The price of the next kWh (incl. VAT) given what was bought this month. */
export function nextKwhPrice(tariff: Settings['tariff'], already: number): number {
  return tariffCost(tariff, already, 1);
}

export function powerForecast(data: Data, bill: Bill, today: string): PowerForecast | null {
  const purchases = data.payments.filter((p) => p.billId === bill.id);
  const readings = data.readings.filter((r) => r.billId === bill.id);
  const use = dailyUse(purchases, readings, today);
  if (!use || use.perDay <= 0) return null;

  // Start from the latest meter reading if there is one, else assume the meter
  // was near empty when the latest top-up was made.
  const lastReading = byDate(readings.filter((r) => r.date <= today)).pop();
  const lastPurchase = byDate(purchases.filter((p) => p.kwh && p.date <= today)).pop();
  let anchorDate: string;
  let balance: number;
  if (lastReading && (!lastPurchase || lastReading.date >= lastPurchase.date)) {
    anchorDate = lastReading.date;
    balance = lastReading.value;
  } else if (lastPurchase) {
    anchorDate = lastPurchase.date;
    balance = sum(purchases.filter((p) => p.date === lastPurchase.date).map((p) => p.kwh ?? 0));
  } else return null;
  // Purchases after a reading (same day counts as after when the reading came first is unknown – ignore).
  if (lastReading && anchorDate === lastReading.date) {
    balance += sum(purchases.filter((p) => p.date > lastReading.date && p.date <= today).map((p) => p.kwh ?? 0));
  }
  const elapsed = Math.max(0, daysUntil(anchorDate, today));
  const remaining = Math.max(0, balance - use.perDay * elapsed);
  const daysLeft = Math.floor(remaining / use.perDay);
  const period = periodOf(today);
  const monthKwh = sum(purchases.filter((p) => periodOf(p.date) === period).map((p) => p.kwh ?? 0));
  const daysToMonthEnd = daysInMonth(period) - Number(today.slice(8, 10)) + 1;
  const toMonthEndKwh = Math.max(0, Math.ceil(use.perDay * daysToMonthEnd - remaining));
  const for30DaysKwh = Math.max(0, Math.ceil(use.perDay * 30 - remaining));
  const tariff = data.settings.tariff;
  return {
    perDay: use.perDay,
    remaining,
    daysLeft,
    runOutDate: addDays(today, daysLeft),
    basis: use.basis,
    monthKwh,
    toMonthEndKwh,
    toMonthEndCost: Math.round(tariffCost(tariff, monthKwh, toMonthEndKwh)),
    for30DaysKwh,
    for30DaysCost: Math.round(tariffCost(tariff, monthKwh, for30DaysKwh)),
  };
}

export interface RefillForecast {
  /** Average days between refills */
  avgDays: number;
  lastRefill: string;
  nextRefill: string;
  daysLeft: number;
  avgCost: number;
}

/** For gas cylinders and similar: predicts the next refill from the gaps between past refills. */
export function refillForecast(data: Data, bill: Bill, today: string): RefillForecast | null {
  const ps = byDate(data.payments.filter((p) => p.billId === bill.id && p.date <= today));
  // Several payments on the same day count as one refill.
  const dates = [...new Set(ps.map((p) => p.date))];
  if (dates.length < 2) return null;
  const recent = dates.slice(-6);
  const gaps = recent.slice(1).map((d, i) => daysUntil(recent[i], d)).filter((g) => g > 0);
  if (!gaps.length) return null;
  const avgDays = sum(gaps) / gaps.length;
  const lastRefill = dates[dates.length - 1];
  const nextRefill = addDays(lastRefill, Math.round(avgDays));
  const costs = recent.map((d) => sum(ps.filter((p) => p.date === d).map((p) => p.amount)));
  return { avgDays, lastRefill, nextRefill, daysLeft: daysUntil(today, nextRefill), avgCost: sum(costs) / costs.length };
}

export interface WaterInterval {
  from: string;
  to: string;
  m3: number;
  perDay: number;
  /** Use per day is well above the usual – possible leak or misread meter */
  spike: boolean;
}

/** Consumption between consecutive water meter readings, flagging unusual jumps. */
export function waterIntervals(readings: Reading[]): WaterInterval[] {
  const rs = byDate(readings);
  const out: WaterInterval[] = [];
  for (let i = 1; i < rs.length; i++) {
    const days = daysUntil(rs[i - 1].date, rs[i].date);
    if (days <= 0) continue;
    const m3 = rs[i].value - rs[i - 1].value;
    out.push({ from: rs[i - 1].date, to: rs[i].date, m3, perDay: m3 / days, spike: false });
  }
  for (let i = 0; i < out.length; i++) {
    const prev = out.slice(Math.max(0, i - 6), i).map((x) => x.perDay).sort((a, b) => a - b);
    if (prev.length >= 2) {
      const median = prev[Math.floor(prev.length / 2)];
      out[i].spike = median > 0 && out[i].perDay > median * 1.5 && out[i].m3 > 1;
    }
  }
  return out;
}
