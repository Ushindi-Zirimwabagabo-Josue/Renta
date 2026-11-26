import { describe, expect, it } from 'vitest';
import { addMonths, amountFor, arrears, billMonth, dueDate, monthSummary, paymentsCsv, spendingByMonth, splitPayment } from './logic';
import { emptyData } from './store';
import type { Bill, Data } from './types';

const rent: Bill = {
  id: 'rent', category: 'rent', name: 'House rent', provider: 'Landlord', frequency: 'fixed',
  amounts: [{ from: '2026-01', amount: 150000 }, { from: '2026-09', amount: 180000 }],
  dueDay: 5, startPeriod: '2026-07', active: true,
};
const water: Bill = {
  id: 'water', category: 'water', name: 'Water', provider: 'WASAC', frequency: 'variable',
  amounts: [{ from: '2026-01', amount: 8000 }], dueDay: 20, startPeriod: '2026-09', active: true,
};
const power: Bill = {
  id: 'power', category: 'electricity', name: 'Cash Power', provider: 'REG', frequency: 'prepaid',
  amounts: [{ from: '2026-01', amount: 20000 }], dueDay: 1, startPeriod: '2026-09', active: true,
};

function data(extra: Partial<Data> = {}): Data {
  return { ...emptyData(), setupDone: true, bills: [rent, water, power], ...extra };
}

describe('periods', () => {
  it('adds months across years', () => {
    expect(addMonths('2026-11', 2)).toBe('2027-01');
    expect(addMonths('2026-01', -1)).toBe('2025-12');
  });
  it('clamps due day to month length', () => {
    expect(dueDate({ ...rent, dueDay: 31 }, '2027-02')).toBe('2027-02-28');
  });
});

describe('amountFor', () => {
  it('uses the amount in effect for the month', () => {
    expect(amountFor(rent, '2026-08')).toBe(150000);
    expect(amountFor(rent, '2026-09')).toBe(180000);
    expect(amountFor(rent, '2027-03')).toBe(180000);
  });
});

describe('billMonth status', () => {
  it('is overdue after the due date when unpaid', () => {
    expect(billMonth(data(), rent, '2026-11', '2026-11-06').status).toBe('overdue');
  });
  it('is due-soon inside the reminder window', () => {
    expect(billMonth(data(), rent, '2026-11', '2026-11-01').status).toBe('due-soon');
  });
  it('is partial then paid', () => {
    const d = data({ payments: [{ id: 'p', billId: 'rent', period: '2026-11', amount: 100000, date: '2026-11-02', method: 'momo' }] });
    const bm = billMonth(d, rent, '2026-11', '2026-11-03');
    expect(bm.status).toBe('partial');
    expect(bm.remaining).toBe(80000);
    d.payments.push({ id: 'q', billId: 'rent', period: '2026-11', amount: 80000, date: '2026-11-04', method: 'cash' });
    expect(billMonth(d, rent, '2026-11', '2026-11-30').status).toBe('paid');
  });
  it('waits for the actual bill on variable bills', () => {
    const bm = billMonth(data(), water, '2026-11', '2026-11-25');
    expect(bm.status).toBe('awaiting-bill');
    expect(bm.estimated).toBe(true);
    const d = data({ charges: [{ id: 'c', billId: 'water', period: '2026-11', amount: 9450 }] });
    const bm2 = billMonth(d, water, '2026-11', '2026-11-25');
    expect(bm2.status).toBe('overdue');
    expect(bm2.expected).toBe(9450);
  });
});

describe('arrears', () => {
  it('collects unpaid earlier months, ignoring estimates and prepaid', () => {
    const d = data({
      charges: [{ id: 'c', billId: 'water', period: '2026-10', amount: 7000 }],
      payments: [
        { id: 'a', billId: 'rent', period: '2026-07', amount: 150000, date: '2026-07-01', method: 'momo' },
        { id: 'b', billId: 'rent', period: '2026-08', amount: 150000, date: '2026-08-01', method: 'momo' },
        { id: 'c', billId: 'rent', period: '2026-09', amount: 150000, date: '2026-09-01', method: 'momo' },
        { id: 'd', billId: 'rent', period: '2026-10', amount: 180000, date: '2026-10-01', method: 'momo' },
      ],
    });
    const a = arrears(d, '2026-11', '2026-11-10');
    expect(a.map((x) => [x.bill.id, x.period, x.remaining])).toEqual([
      ['rent', '2026-09', 30000],
      ['water', '2026-10', 7000],
    ]);
  });
  it('stops at the end period of an archived bill', () => {
    const d = data({ bills: [{ ...rent, active: false, endPeriod: '2026-07' }] });
    expect(arrears(d, '2026-11', '2026-11-10').map((x) => x.period)).toEqual(['2026-07']);
  });
});

describe('monthSummary', () => {
  it('totals bills and spending', () => {
    const d = data({
      payments: [
        { id: 'a', billId: 'rent', period: '2026-11', amount: 180000, date: '2026-11-01', method: 'momo' },
        { id: 'b', billId: 'power', period: '2026-11', amount: 10000, date: '2026-11-03', method: 'momo', kwh: 50 },
      ],
    });
    const s = monthSummary(d, '2026-11', '2026-11-10');
    expect(s.expected).toBe(188000);
    expect(s.remaining).toBe(8000);
    expect(s.spent).toBe(190000);
    expect(s.hasEstimates).toBe(true);
    expect(s.prepaid[0].kwh).toBe(50);
  });
});

describe('splitPayment', () => {
  it('splits across months and keeps the total exact', () => {
    const ps = splitPayment({ billId: 'rent', amount: 100000, date: '2026-11-01', method: 'bank' }, '2026-11', 3);
    expect(ps.map((p) => p.period)).toEqual(['2026-11', '2026-12', '2027-01']);
    expect(ps.reduce((a, p) => a + p.amount, 0)).toBe(100000);
  });
});

describe('reports', () => {
  it('groups spending by category per month', () => {
    const d = data({ payments: [{ id: 'b', billId: 'power', period: '2026-11', amount: 10000, date: '2026-11-03', method: 'momo' }] });
    const s = spendingByMonth(d, '2026-11', 3);
    expect(s.map((x) => x.period)).toEqual(['2026-09', '2026-10', '2026-11']);
    expect(s[2].byCategory.electricity).toBe(10000);
  });
  it('escapes CSV values', () => {
    const d = data({ payments: [{ id: 'b', billId: 'rent', period: '2026-11', amount: 1, date: '2026-11-03', method: 'cash', note: 'a, "b"' }] });
    expect(paymentsCsv(d).split('\n')[1]).toContain('"a, ""b"""');
  });
});
