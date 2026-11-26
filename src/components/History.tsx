import { useMemo, useState } from 'react';
import { CATEGORIES, categoryInfo, dateLabel, formatRWF, methodLabel, paymentsCsv, periodLabel, sum, todayStr } from '../logic';
import type { Category, Data } from '../types';
import type { Action } from '../App';
import { download } from '../download';

export function History({ data, act }: { data: Data; act: (a: Action) => void }) {
  const [cat, setCat] = useState<Category | 'all'>('all');
  const [year, setYear] = useState<string>('all');
  const [q, setQ] = useState('');
  const billById = useMemo(() => new Map(data.bills.map((b) => [b.id, b])), [data.bills]);
  const years = [...new Set(data.payments.map((p) => p.date.slice(0, 4)))].sort().reverse();

  const rows = data.payments
    .filter((p) => {
      const b = billById.get(p.billId);
      if (cat !== 'all' && b?.category !== cat) return false;
      if (year !== 'all' && !p.date.startsWith(year)) return false;
      if (q) {
        const hay = [b?.name, b?.provider, p.reference, p.note, p.token, methodLabel(p.method)].join(' ').toLowerCase();
        if (!hay.includes(q.toLowerCase())) return false;
      }
      return true;
    })
    .sort((a, b) => b.date.localeCompare(a.date) || b.period.localeCompare(a.period));

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h2>Payment history</h2>
          <p className="muted small">{rows.length} payment{rows.length === 1 ? '' : 's'} · {formatRWF(sum(rows.map((r) => r.amount)))}</p>
        </div>
        <button className="btn ghost" disabled={!data.payments.length} onClick={() => download(`renta-payments-${todayStr()}.csv`, paymentsCsv(data), 'text/csv')}>
          Export CSV
        </button>
      </div>
      <div className="filters">
        <select value={cat} onChange={(e) => setCat(e.target.value as Category | 'all')} aria-label="Category">
          <option value="all">All categories</option>
          {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}
        </select>
        <select value={year} onChange={(e) => setYear(e.target.value)} aria-label="Year">
          <option value="all">All years</option>
          {years.map((y) => <option key={y}>{y}</option>)}
        </select>
        <input type="search" placeholder="Search reference, note, token…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="card table-wrap">
        <table className="table">
          <thead>
            <tr><th>Date</th><th>Bill</th><th>For</th><th>Method</th><th className="r">Amount</th></tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={5} className="empty">No payments found.</td></tr>}
            {rows.map((p) => {
              const b = billById.get(p.billId);
              return (
                <tr key={p.id} className="clickable" onClick={() => act({ kind: 'receipt', paymentId: p.id })}>
                  <td>{dateLabel(p.date)}</td>
                  <td>
                    {b ? categoryInfo(b.category).icon : ''} {b?.name ?? '(deleted bill)'}
                    {(p.reference || p.token) && <div className="muted small">{p.token ? `Token ${p.token}` : `Ref ${p.reference}`}</div>}
                  </td>
                  <td>{periodLabel(p.period, true)}</td>
                  <td>{methodLabel(p.method)}</td>
                  <td className="r"><strong>{formatRWF(p.amount)}</strong>{p.kwh ? <div className="muted small">{p.kwh} kWh</div> : null}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
