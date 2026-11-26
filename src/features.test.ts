import { describe, expect, it } from 'vitest';
import { emptyData, merge, parseData, stamp } from './data';
import { parseSms } from './sms';
import { powerForecast, refillForecast, tariffCost, waterIntervals } from './forecast';
import { budgetLines, cashFlow, goalProgress, monthChanges } from './money';
import { allEvents, toIcs } from './calendar';
import type { Bill, Data, Payment } from './types';

const bill = (over: Partial<Bill>): Bill => ({
  id: 'b', category: 'rent', name: 'Rent', provider: 'Landlord', frequency: 'fixed',
  amounts: [{ from: '2026-01', amount: 100000 }], dueDay: 5, startPeriod: '2026-01', active: true, ...over,
});
const pay = (over: Partial<Payment>): Payment => ({ id: Math.random().toString(36), billId: 'b', period: '2026-11', amount: 1000, date: '2026-11-01', method: 'momo', ...over });
const data = (over: Partial<Data>): Data => ({ ...emptyData(), setupDone: true, ...over });

describe('SMS parser', () => {
  const power = bill({ id: 'power', category: 'electricity', frequency: 'prepaid', name: 'Cash Power' });
  const rent = bill({ id: 'rent', payTo: '0788 123 456' });

  it('reads a MoMo transfer and ignores the fee and balance', () => {
    const p = parseSms(
      '*165*S*150,000 RWF transferred to Jean Bosco (250788123456) at 2026-11-03 10:15:22. Fee was: 0 RWF. New balance: 32,500 RWF. Financial Transaction Id: 18273645501.',
      [power, rent],
    );
    expect(p.amount).toBe(150000);
    expect(p.date).toBe('2026-11-03');
    expect(p.reference).toBe('18273645501');
    expect(p.recipient).toBe('Jean Bosco');
    expect(p.method).toBe('momo');
    expect(p.billId).toBe('rent');
  });

  it('reads a Cash Power token message', () => {
    const p = parseSms('Your payment of 10,000 RWF for Cash Power meter 04123456789 was successful on 12/11/2026. Token: 1234-5678-9012-3456-7890 Units: 42.3 kWh. TxId: 99887766', [power, rent]);
    expect(p.amount).toBe(10000);
    expect(p.date).toBe('2026-11-12');
    expect(p.token).toBe('1234 5678 9012 3456 7890');
    expect(p.kwh).toBe(42.3);
    expect(p.billId).toBe('power');
  });

  it('detects Airtel Money', () => {
    const p = parseSms('Airtel Money: You have paid RWF 5000 to Umudugudu Security. Balance RWF 1200. Trans ID: CI261103.1234.A12345', []);
    expect(p.amount).toBe(5000);
    expect(p.method).toBe('airtel');
    expect(p.reference).toBe('CI261103.1234.A12345');
  });
});

describe('power forecast', () => {
  const power = bill({ id: 'p', category: 'electricity', frequency: 'prepaid' });
  it('estimates use from purchase history', () => {
    const d = data({
      bills: [power],
      payments: [
        pay({ billId: 'p', date: '2026-10-01', kwh: 30, amount: 7000 }),
        pay({ billId: 'p', date: '2026-10-16', kwh: 30, amount: 7000 }),
        pay({ billId: 'p', date: '2026-10-31', kwh: 30, amount: 7000 }),
      ],
    });
    const f = powerForecast(d, power, '2026-11-05')!;
    expect(f.perDay).toBe(2); // 60 kWh over 30 days
    expect(f.remaining).toBe(20); // 30 bought on 31 Oct, minus 5 days × 2
    expect(f.daysLeft).toBe(10);
    expect(f.basis).toBe('purchases');
  });
  it('prefers meter readings', () => {
    const d = data({
      bills: [power],
      payments: [pay({ billId: 'p', date: '2026-11-05', kwh: 20 })],
      readings: [
        { id: 'r1', billId: 'p', date: '2026-11-01', value: 15 },
        { id: 'r2', billId: 'p', date: '2026-11-11', value: 5 },
      ],
    });
    const f = powerForecast(d, power, '2026-11-11')!;
    expect(f.perDay).toBe(3); // 15 + 20 − 5 = 30 over 10 days
    expect(f.remaining).toBe(5);
    expect(f.basis).toBe('readings');
  });
  it('prices kWh across tariff blocks', () => {
    const tariff = { blocks: [{ upTo: 20, price: 100 }, { upTo: null, price: 300 }], vatPct: 0 };
    expect(tariffCost(tariff, 0, 10)).toBe(1000);
    expect(tariffCost(tariff, 15, 10)).toBe(5 * 100 + 5 * 300);
    expect(tariffCost(tariff, 30, 1)).toBe(300);
  });
});

describe('gas refills', () => {
  it('predicts the next refill', () => {
    const gas = bill({ id: 'g', category: 'gas', frequency: 'prepaid' });
    const d = data({ bills: [gas], payments: [pay({ billId: 'g', date: '2026-08-01', amount: 18000 }), pay({ billId: 'g', date: '2026-09-15', amount: 18000 }), pay({ billId: 'g', date: '2026-10-30', amount: 19000 })] });
    const f = refillForecast(d, gas, '2026-11-26')!;
    expect(f.avgDays).toBe(45);
    expect(f.nextRefill).toBe('2026-12-14');
    expect(f.daysLeft).toBe(18);
  });
});

describe('water readings', () => {
  it('flags a jump in daily use', () => {
    const iv = waterIntervals([
      { id: '1', billId: 'w', date: '2026-07-01', value: 100 },
      { id: '2', billId: 'w', date: '2026-08-01', value: 110 },
      { id: '3', billId: 'w', date: '2026-09-01', value: 121 },
      { id: '4', billId: 'w', date: '2026-10-01', value: 131 },
      { id: '5', billId: 'w', date: '2026-11-01', value: 160 },
    ]);
    expect(iv.map((x) => x.m3)).toEqual([10, 11, 10, 29]);
    expect(iv.map((x) => x.spike)).toEqual([false, false, false, true]);
  });
});

describe('money', () => {
  it('computes cash flow, budgets and month changes', () => {
    const d = data({
      bills: [bill({})],
      payments: [pay({ amount: 80000, period: '2026-10' }), pay({ amount: 100000 })],
      incomes: [{ id: 'i', label: 'Salary', amount: 400000, date: '2026-11-28', period: '2026-11' }],
      goals: [{ id: 'g', name: 'Deposit', target: 300000, deadline: '2027-03', deposits: [{ id: 'd', date: '2026-11-29', amount: 50000 }] }],
    });
    d.settings.budgets = { rent: 95000 };
    d.settings.totalBudget = 200000;
    expect(cashFlow(d, '2026-11')).toEqual({ income: 400000, spent: 100000, saved: 50000, left: 250000 });
    const lines = budgetLines(d, '2026-11');
    expect(lines.map((l) => [l.category, l.state])).toEqual([['rent', 'over'], ['total', 'ok']]);
    expect(monthChanges(d, '2026-11')[0].pct).toBe(25);
    const g = goalProgress(d.goals[0], '2026-11-30');
    expect(g.monthsLeft).toBe(5);
    expect(g.perMonthNeeded).toBe(50000);
  });
});

describe('calendar', () => {
  it('exports monthly reminders as iCalendar', () => {
    const d = data({ bills: [bill({ dueDay: 31, lease: { end: '2027-06-30' } })] });
    const ics = toIcs(allEvents(d, '2026-11-26'));
    expect(ics).toContain('RRULE:FREQ=MONTHLY;BYMONTHDAY=-1');
    expect(ics).toContain('DTSTART;VALUE=DATE:20261130');
    expect(ics).toContain('DTSTART;VALUE=DATE:20270630');
    expect(ics).toContain('TRIGGER:-P4DT15H');
    expect(ics.split('\r\n').every((l) => new TextEncoder().encode(l).length <= 75)).toBe(true);
  });
});

describe('sync merge', () => {
  it('keeps the newest version of each record and honours deletions', () => {
    const base = data({ payments: [pay({ id: 'a' }), pay({ id: 'b' })] });
    const phone = stamp(base, { ...base, payments: [{ ...base.payments[0], amount: 5 }] }, 1000); // edit a, delete b
    const laptop = stamp(base, { ...base, payments: [...base.payments, pay({ id: 'c' })] }, 2000); // add c
    const m = merge(phone, laptop);
    expect(m.payments.map((p) => p.id).sort()).toEqual(['a', 'c']);
    expect(m.payments.find((p) => p.id === 'a')!.amount).toBe(5);
  });
  it('migrates v1 backups', () => {
    const d = parseData({ version: 1, bills: [], payments: [], settings: { householdName: 'x', reminderDays: 3 } });
    expect(d.version).toBe(2);
    expect(d.settings.language).toBe('en');
    expect(d.goals).toEqual([]);
  });
});
