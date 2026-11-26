import { CATEGORIES, addMonths, monthsBetween, periodOf, sum } from './logic';
import type { Bill, Category, Data, Goal, Period } from './types';

export function spentByCategory(data: Data, p: Period): Record<Category, number> {
  const billCat = new Map(data.bills.map((b) => [b.id, b.category]));
  const out = Object.fromEntries(CATEGORIES.map((c) => [c.id, 0])) as Record<Category, number>;
  for (const pay of data.payments) if (pay.period === p) out[billCat.get(pay.billId) ?? 'other'] += pay.amount;
  return out;
}

export interface IncomeMonth {
  received: number;
  /** Salary etc. still expected this month from regular income sources */
  expectedMore: number;
  sources: { id: string; name: string; expected: number; received: number }[];
}

export function incomeMonth(data: Data, p: Period): IncomeMonth {
  const entries = data.incomes.filter((i) => i.period === p);
  const sources = data.incomeSources
    .filter((s) => s.active)
    .map((s) => ({ id: s.id, name: s.name, expected: s.amount, received: sum(entries.filter((e) => e.sourceId === s.id).map((e) => e.amount)) }));
  return {
    received: sum(entries.map((e) => e.amount)),
    expectedMore: sum(sources.map((s) => Math.max(0, s.expected - s.received))),
    sources,
  };
}

export function savedIn(data: Data, p: Period): number {
  return sum(data.goals.flatMap((g) => g.deposits).filter((d) => periodOf(d.date) === p).map((d) => d.amount));
}

export interface CashFlow {
  income: number;
  spent: number;
  saved: number;
  left: number;
}

export function cashFlow(data: Data, p: Period): CashFlow {
  const income = incomeMonth(data, p).received;
  const spent = sum(data.payments.filter((x) => x.period === p).map((x) => x.amount));
  const saved = savedIn(data, p);
  return { income, spent, saved, left: income - spent - saved };
}

export type BudgetState = 'ok' | 'near' | 'over';
export interface BudgetLine {
  category: Category | 'total';
  budget: number;
  spent: number;
  pct: number;
  state: BudgetState;
}

// Spending exactly the budget is fine (e.g. rent); warn from 90% up to it, and when over.
const stateOf = (spent: number, budget: number): BudgetState => (spent > budget ? 'over' : spent >= budget * 0.9 && spent < budget ? 'near' : 'ok');

/** Budget use per category for a month, plus the overall budget if set. */
export function budgetLines(data: Data, p: Period): BudgetLine[] {
  const spent = spentByCategory(data, p);
  const lines: BudgetLine[] = [];
  for (const c of CATEGORIES) {
    const budget = data.settings.budgets[c.id];
    if (!budget) continue;
    lines.push({ category: c.id, budget, spent: spent[c.id], pct: (spent[c.id] / budget) * 100, state: stateOf(spent[c.id], budget) });
  }
  const total = data.settings.totalBudget;
  if (total) {
    const s = sum(Object.values(spent));
    lines.push({ category: 'total', budget: total, spent: s, pct: (s / total) * 100, state: stateOf(s, total) });
  }
  return lines;
}

/** Suggested category budgets from the bills' current amounts. */
export function suggestedBudgets(data: Data, p: Period): Partial<Record<Category, number>> {
  const out: Partial<Record<Category, number>> = {};
  for (const b of data.bills.filter((x) => x.active)) {
    const amt = currentAmount(b, p);
    if (amt > 0) out[b.category] = (out[b.category] ?? 0) + amt;
  }
  return out;
}

function currentAmount(b: Bill, p: Period): number {
  const sorted = [...b.amounts].sort((a, c) => a.from.localeCompare(c.from));
  let amt = sorted[0]?.amount ?? 0;
  for (const c of sorted) if (c.from <= p) amt = c.amount;
  return amt;
}

export interface GoalProgress {
  saved: number;
  pct: number;
  remaining: number;
  monthsLeft: number | null;
  perMonthNeeded: number | null;
  done: boolean;
  overdue: boolean;
}

export function goalProgress(g: Goal, today: string): GoalProgress {
  const saved = sum(g.deposits.map((d) => d.amount));
  const remaining = Math.max(0, g.target - saved);
  const done = remaining === 0;
  let monthsLeft: number | null = null;
  let perMonthNeeded: number | null = null;
  let overdue = false;
  if (g.deadline) {
    // Months left including the deadline month itself.
    monthsLeft = monthsBetween(periodOf(today), g.deadline) + 1;
    overdue = monthsLeft <= 0 && !done;
    perMonthNeeded = done ? 0 : monthsLeft > 0 ? Math.ceil(remaining / monthsLeft) : remaining;
  }
  return { saved, pct: g.target > 0 ? Math.min(100, (saved / g.target) * 100) : 0, remaining, monthsLeft, perMonthNeeded, done, overdue };
}

export interface Change {
  category: Category;
  now: number;
  before: number;
  pct: number;
}

/** Categories whose spending moved by 10% or more compared with the month before. */
export function monthChanges(data: Data, p: Period): Change[] {
  const now = spentByCategory(data, p);
  const before = spentByCategory(data, addMonths(p, -1));
  return CATEGORIES.filter((c) => now[c.id] > 0 && before[c.id] > 0)
    .map((c) => ({ category: c.id, now: now[c.id], before: before[c.id], pct: ((now[c.id] - before[c.id]) / before[c.id]) * 100 }))
    .filter((x) => Math.abs(x.pct) >= 10)
    .sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct));
}

/** Average monthly spend per bill over the last `n` months it was active (up to `p`). */
export function billAverages(data: Data, p: Period, n = 6): { bill: Bill; avg: number; months: number }[] {
  return data.bills
    .map((bill) => {
      const first = bill.startPeriod > addMonths(p, -(n - 1)) ? bill.startPeriod : addMonths(p, -(n - 1));
      const months = Math.max(0, monthsBetween(first, p) + 1);
      const total = sum(data.payments.filter((x) => x.billId === bill.id && x.period >= first && x.period <= p).map((x) => x.amount));
      return { bill, avg: months ? total / months : 0, months };
    })
    .filter((x) => x.months > 0 && x.avg > 0)
    .sort((a, b) => b.avg - a.avg);
}

/** Spending per category per month of a year. */
export function yearTotals(data: Data, year: number): { byCategory: Record<Category, number>; byMonth: number[]; total: number; income: number; saved: number } {
  const byCategory = Object.fromEntries(CATEGORIES.map((c) => [c.id, 0])) as Record<Category, number>;
  const byMonth = Array(12).fill(0);
  const billCat = new Map(data.bills.map((b) => [b.id, b.category]));
  for (const pay of data.payments) {
    if (!pay.period.startsWith(`${year}-`)) continue;
    byCategory[billCat.get(pay.billId) ?? 'other'] += pay.amount;
    byMonth[Number(pay.period.slice(5, 7)) - 1] += pay.amount;
  }
  const income = sum(data.incomes.filter((i) => i.period.startsWith(`${year}-`)).map((i) => i.amount));
  const saved = sum(data.goals.flatMap((g) => g.deposits).filter((d) => d.date.startsWith(`${year}-`)).map((d) => d.amount));
  return { byCategory, byMonth, total: sum(byMonth), income, saved };
}
