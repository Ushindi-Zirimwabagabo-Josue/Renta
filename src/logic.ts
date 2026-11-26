import type { Bill, Category, Charge, Data, Frequency, Method, Payment, Period } from './types';
import { monthName, t, tk } from './i18n';

export interface CategoryInfo {
  id: Category;
  label: string;
  local: string;
  icon: string;
  defaultProvider: string;
  defaultFrequency: Frequency;
  defaultDueDay: number;
  hint: string;
}

export const CATEGORIES: CategoryInfo[] = [
  { id: 'rent', label: tk('Rent'), local: 'Ubukode', icon: '🏠', defaultProvider: tk('Landlord'), defaultFrequency: 'fixed', defaultDueDay: 5, hint: tk('Monthly rent to your landlord') },
  { id: 'water', label: tk('Water'), local: 'Amazi', icon: '💧', defaultProvider: 'WASAC', defaultFrequency: 'variable', defaultDueDay: 20, hint: tk('WASAC bill varies – enter your usual amount as an estimate') },
  { id: 'electricity', label: tk('Electricity'), local: 'Amashanyarazi', icon: '⚡', defaultProvider: 'REG (Cash Power)', defaultFrequency: 'prepaid', defaultDueDay: 1, hint: tk('Cash Power is prepaid – set a monthly budget') },
  { id: 'security', label: tk('Security'), local: 'Umutekano', icon: '🛡️', defaultProvider: 'Umudugudu', defaultFrequency: 'fixed', defaultDueDay: 10, hint: tk('Monthly umutekano fee to your umudugudu') },
  { id: 'sanitation', label: tk('Sanitation'), local: 'Isuku', icon: '🧹', defaultProvider: tk('Waste collection company'), defaultFrequency: 'fixed', defaultDueDay: 10, hint: tk('Monthly isuku fee for waste collection') },
  { id: 'internet', label: tk('Internet'), local: 'Interineti', icon: '📶', defaultProvider: '', defaultFrequency: 'fixed', defaultDueDay: 1, hint: tk('Home internet / Wi-Fi subscription') },
  { id: 'tv', label: tk('TV'), local: 'Televiziyo', icon: '📺', defaultProvider: 'Canal+', defaultFrequency: 'fixed', defaultDueDay: 1, hint: tk('Canal+, StarTimes or DStv – the due day is your renewal date') },
  { id: 'gas', label: tk('Cooking gas'), local: 'Gaz', icon: '🔥', defaultProvider: '', defaultFrequency: 'prepaid', defaultDueDay: 1, hint: tk('Log each refill – the app learns how long a cylinder lasts') },
  { id: 'airtime', label: tk('Airtime & data'), local: 'Amainite', icon: '📱', defaultProvider: 'MTN / Airtel', defaultFrequency: 'prepaid', defaultDueDay: 1, hint: tk('Airtime and data bundles against a monthly budget') },
  { id: 'househelp', label: tk('House help'), local: 'Umukozi', icon: '🧑‍🍳', defaultProvider: '', defaultFrequency: 'fixed', defaultDueDay: 30, hint: tk('Monthly salary – advances are deducted from it') },
  { id: 'contributions', label: tk('Contributions'), local: 'Imisanzu / Ubufasha', icon: '🤝', defaultProvider: '', defaultFrequency: 'occasional', defaultDueDay: 1, hint: tk('Tithe, offerings, weddings and funerals') },
  { id: 'other', label: tk('Other'), local: 'Ibindi', icon: '📄', defaultProvider: '', defaultFrequency: 'fixed', defaultDueDay: 1, hint: '' },
];

/** The categories offered in the first-run setup. */
export const SETUP_CATEGORIES: Category[] = ['rent', 'water', 'electricity', 'security', 'sanitation', 'internet', 'tv', 'gas', 'airtime', 'househelp', 'contributions'];
export const DEFAULT_ON: Category[] = ['rent', 'water', 'electricity', 'security', 'sanitation'];

export const categoryInfo = (c: Category) => CATEGORIES.find((x) => x.id === c) ?? CATEGORIES[CATEGORIES.length - 1];
export const categoryLabel = (c: Category) => t(categoryInfo(c).label);

/** A bill's name; default English category names follow the chosen language. */
export const billName = (b: { name: string; category: Category }): string => (b.name === categoryInfo(b.category).label ? t(b.name) : b.name);

export const METHODS: { id: Method; label: string }[] = [
  { id: 'momo', label: 'MTN MoMo' },
  { id: 'airtel', label: 'Airtel Money' },
  { id: 'cash', label: tk('Cash') },
  { id: 'bank', label: tk('Bank transfer') },
  { id: 'card', label: tk('Card') },
  { id: 'other', label: tk('Other') },
];
export const methodLabel = (m: Method) => t(METHODS.find((x) => x.id === m)?.label ?? m);

export const FREQUENCIES: { id: Frequency; label: string; hint: string }[] = [
  { id: 'fixed', label: tk('Fixed monthly'), hint: tk('Same amount every month') },
  { id: 'variable', label: tk('Varies monthly'), hint: tk('You enter the bill each month (e.g. WASAC water)') },
  { id: 'prepaid', label: tk('Prepaid / top-up'), hint: tk('Buy units when needed (e.g. Cash Power, gas, airtime)') },
  { id: 'occasional', label: tk('Occasional'), hint: tk('Record contributions when they happen (tithe, weddings, funerals)') },
];

/** Bills tracked as a running log of top-ups or contributions rather than a monthly amount owed. */
export const isLogBill = (b: Bill) => b.frequency === 'prepaid' || b.frequency === 'occasional';

/* ---------- ids & formatting ---------- */

export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function formatRWF(n: number): string {
  return `${Math.round(n).toLocaleString('en-US')} RWF`;
}

export function formatCompact(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `${+(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${+(n / 1_000).toFixed(1)}k`;
  if (Math.abs(n) < 10) return String(+n.toFixed(2));
  return String(Math.round(n));
}

/* ---------- dates & periods ---------- */

const pad = (n: number) => String(n).padStart(2, '0');

export function todayStr(d = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function periodOf(date: string): Period {
  return date.slice(0, 7);
}

export function addMonths(p: Period, n: number): Period {
  const [y, m] = p.split('-').map(Number);
  const idx = y * 12 + (m - 1) + n;
  return `${Math.floor(idx / 12)}-${pad((idx % 12) + 1)}`;
}

export function monthsBetween(a: Period, b: Period): number {
  const [ay, am] = a.split('-').map(Number);
  const [by, bm] = b.split('-').map(Number);
  return by * 12 + bm - (ay * 12 + am);
}

export function daysInMonth(p: Period): number {
  const [y, m] = p.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}

export function dueDate(bill: Bill, p: Period): string {
  const day = Math.min(Math.max(1, bill.dueDay), daysInMonth(p));
  return `${p}-${pad(day)}`;
}

export function daysUntil(from: string, to: string): number {
  const a = Date.UTC(+from.slice(0, 4), +from.slice(5, 7) - 1, +from.slice(8, 10));
  const b = Date.UTC(+to.slice(0, 4), +to.slice(5, 7) - 1, +to.slice(8, 10));
  return Math.round((b - a) / 86_400_000);
}

export function periodLabel(p: Period, short = false): string {
  const [y, m] = p.split('-').map(Number);
  const name = monthName(m - 1, short);
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${y}`;
}

export function dateLabel(d: string): string {
  const [y, m, day] = d.split('-').map(Number);
  return `${day} ${monthName(m - 1, true)} ${y}`;
}

export function addDays(date: string, n: number): string {
  const [y, m, d] = date.split('-').map(Number);
  return todayStr(new Date(y, m - 1, d + n));
}

/* ---------- bill logic ---------- */

/** The bill's configured amount in effect for a given month. */
export function amountFor(bill: Bill, p: Period): number {
  const sorted = [...bill.amounts].sort((a, b) => a.from.localeCompare(b.from));
  let amt = sorted[0]?.amount ?? 0;
  for (const c of sorted) if (c.from <= p) amt = c.amount;
  return amt;
}

/** Whether a bill is in force for a month. */
export function appliesTo(bill: Bill, p: Period): boolean {
  if (p < bill.startPeriod) return false;
  if (bill.endPeriod && p > bill.endPeriod) return false;
  return true;
}

export type Status = 'paid' | 'overdue' | 'partial' | 'due-soon' | 'upcoming' | 'awaiting-bill';

export interface BillMonth {
  bill: Bill;
  period: Period;
  /** Amount owed for the month (charge for variable bills; estimate when no charge yet) */
  expected: number;
  estimated: boolean;
  charge?: Charge;
  paid: number;
  remaining: number;
  due: string;
  daysLeft: number;
  status: Status;
  payments: Payment[];
}

export function billMonth(data: Data, bill: Bill, p: Period, today: string): BillMonth {
  const payments = data.payments.filter((x) => x.billId === bill.id && x.period === p);
  const paid = sum(payments.map((x) => x.amount));
  const charge = data.charges.find((c) => c.billId === bill.id && c.period === p);
  let expected = amountFor(bill, p);
  let estimated = false;
  if (bill.frequency === 'variable') {
    if (charge) expected = charge.amount;
    else estimated = true;
  }
  const due = dueDate(bill, p);
  const daysLeft = daysUntil(today, due);
  const remaining = Math.max(0, expected - paid);
  let status: Status;
  if (bill.frequency === 'variable' && !charge && paid === 0) status = 'awaiting-bill';
  else if (remaining <= 0) status = 'paid';
  else if (daysLeft < 0) status = 'overdue';
  else if (paid > 0) status = 'partial';
  else if (daysLeft <= data.settings.reminderDays) status = 'due-soon';
  else status = 'upcoming';
  if (estimated && paid > 0 && remaining <= 0) status = 'paid';
  return { bill, period: p, expected, estimated, charge, paid, remaining, due, daysLeft, status, payments };
}

export interface PrepaidMonth {
  bill: Bill;
  period: Period;
  budget: number;
  spent: number;
  kwh: number;
  payments: Payment[];
}

export function prepaidMonth(data: Data, bill: Bill, p: Period): PrepaidMonth {
  const payments = data.payments.filter((x) => x.billId === bill.id && x.period === p);
  return {
    bill,
    period: p,
    budget: amountFor(bill, p),
    spent: sum(payments.map((x) => x.amount)),
    kwh: sum(payments.map((x) => x.kwh ?? 0)),
    payments,
  };
}

/** Bills to display for a month: those in force, plus any with payments recorded that month. */
export function billsForPeriod(data: Data, p: Period): Bill[] {
  return data.bills.filter(
    (b) => appliesTo(b, p) || data.payments.some((x) => x.billId === b.id && x.period === p),
  );
}

export interface ArrearsItem {
  bill: Bill;
  period: Period;
  remaining: number;
}

/**
 * Unpaid amounts from months before `p`. Variable bills only count months where
 * an actual bill (charge) was recorded – estimates are never treated as debt.
 */
export function arrears(data: Data, p: Period, today: string): ArrearsItem[] {
  const out: ArrearsItem[] = [];
  for (const bill of data.bills) {
    if (isLogBill(bill)) continue;
    const last = addMonths(p, -1);
    const end = bill.endPeriod && bill.endPeriod < last ? bill.endPeriod : last;
    const n = monthsBetween(bill.startPeriod, end);
    for (let i = 0; i <= n && i < 240; i++) {
      const q = addMonths(bill.startPeriod, i);
      const bm = billMonth(data, bill, q, today);
      if (bm.estimated) continue;
      if (bm.remaining > 0) out.push({ bill, period: q, remaining: bm.remaining });
    }
  }
  return out.sort((a, b) => a.period.localeCompare(b.period));
}

export interface MonthSummary {
  period: Period;
  rows: BillMonth[];
  prepaid: PrepaidMonth[];
  expected: number;
  paidTowardBills: number;
  remaining: number;
  spent: number;
  hasEstimates: boolean;
}

export function monthSummary(data: Data, p: Period, today: string): MonthSummary {
  const bills = billsForPeriod(data, p);
  const rows = bills.filter((b) => !isLogBill(b)).map((b) => billMonth(data, b, p, today));
  const prepaid = bills.filter(isLogBill).map((b) => prepaidMonth(data, b, p));
  return {
    period: p,
    rows,
    prepaid,
    expected: sum(rows.map((r) => r.expected)),
    paidTowardBills: sum(rows.map((r) => r.paid)),
    remaining: sum(rows.map((r) => r.remaining)),
    spent: sum(data.payments.filter((x) => x.period === p).map((x) => x.amount)),
    hasEstimates: rows.some((r) => r.estimated),
  };
}

/** Spending per category for each of the `n` months ending at `end`. */
export function spendingByMonth(data: Data, end: Period, n: number): { period: Period; byCategory: Record<Category, number>; total: number }[] {
  const billCat = new Map(data.bills.map((b) => [b.id, b.category]));
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const p = addMonths(end, -i);
    const byCategory = Object.fromEntries(CATEGORIES.map((c) => [c.id, 0])) as Record<Category, number>;
    for (const pay of data.payments) {
      if (pay.period !== p) continue;
      const c = billCat.get(pay.billId) ?? 'other';
      byCategory[c] += pay.amount;
    }
    out.push({ period: p, byCategory, total: sum(Object.values(byCategory)) });
  }
  return out;
}

/**
 * Splits one payment that covers several months (e.g. 3 months of rent paid at once)
 * into one payment per month, starting at `startPeriod`.
 */
export function splitPayment(base: Omit<Payment, 'id' | 'period'>, startPeriod: Period, months: number): Payment[] {
  const n = Math.max(1, Math.floor(months));
  const each = Math.floor(base.amount / n);
  const out: Payment[] = [];
  for (let i = 0; i < n; i++) {
    const amount = i === n - 1 ? base.amount - each * (n - 1) : each;
    out.push({
      ...base,
      id: uid(),
      period: addMonths(startPeriod, i),
      amount,
      note: n > 1 ? [base.note, t('Part {i}/{n} of {total}', { i: i + 1, n, total: formatRWF(base.amount) })].filter(Boolean).join(' · ') : base.note,
    });
  }
  return out;
}

export function sum(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0);
}

/* ---------- export ---------- */

export function paymentsCsv(data: Data): string {
  const billById = new Map(data.bills.map((b) => [b.id, b]));
  const esc = (v: unknown) => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = [t('Date'), t('For month'), t('Category'), t('Bill'), t('Provider'), t('Amount (RWF)'), t('Method'), t('Reference'), 'kWh', t('Token'), t('Note')];
  const rows = [...data.payments]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((p) => {
      const b = billById.get(p.billId);
      return [p.date, p.period, b ? categoryLabel(b.category) : '', b?.name ?? t('(deleted bill)'), b?.provider ?? '', p.amount, methodLabel(p.method), p.reference, p.kwh, p.token, p.note];
    });
  return [header, ...rows].map((r) => r.map(esc).join(',')).join('\n');
}

export function receiptText(data: Data, p: Payment): string {
  const b = data.bills.find((x) => x.id === p.billId);
  const lines = [
    `${t('Payment receipt')} – ${b ? `${categoryLabel(b.category)} (${billName(b)})` : t('Bill')}`,
    `${t('For')}: ${periodLabel(p.period)}`,
    `${t('Amount')}: ${formatRWF(p.amount)}`,
    `${t('Paid on')}: ${dateLabel(p.date)} – ${methodLabel(p.method)}`,
  ];
  if (p.reference) lines.push(`${t('Reference')}: ${p.reference}`);
  if (p.token) lines.push(`${t('Token')}: ${p.token}`);
  if (p.kwh) lines.push(`${t('Units')}: ${p.kwh} kWh`);
  if (data.settings.householdName) lines.push(`${t('From')}: ${data.settings.householdName}`);
  return lines.join('\n');
}
