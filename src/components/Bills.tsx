import { FREQUENCIES, amountFor, categoryInfo, formatRWF, periodLabel } from '../logic';
import type { Data, Period } from '../types';
import type { Action } from '../App';
import type { Update } from '../store';

export function Bills({ data, update, current, act }: { data: Data; update: Update; current: Period; act: (a: Action) => void }) {
  const active = data.bills.filter((b) => b.active);
  const archived = data.bills.filter((b) => !b.active);

  const archive = (id: string) =>
    update((d) => ({ ...d, bills: d.bills.map((b) => (b.id === id ? { ...b, active: false, endPeriod: current } : b)) }));
  const restore = (id: string) =>
    update((d) => ({ ...d, bills: d.bills.map((b) => (b.id === id ? { ...b, active: true, endPeriod: undefined } : b)) }));
  const remove = (id: string) => {
    const n = data.payments.filter((p) => p.billId === id).length;
    if (!confirm(`Delete this bill${n ? ` and its ${n} payment record${n > 1 ? 's' : ''}` : ''}? This cannot be undone.`)) return;
    update((d) => ({
      ...d,
      bills: d.bills.filter((b) => b.id !== id),
      payments: d.payments.filter((p) => p.billId !== id),
      charges: d.charges.filter((c) => c.billId !== id),
    }));
  };

  const totalMonthly = active.filter((b) => b.frequency !== 'prepaid').reduce((a, b) => a + amountFor(b, current), 0);
  const prepaidBudget = active.filter((b) => b.frequency === 'prepaid').reduce((a, b) => a + amountFor(b, current), 0);

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h2>Your bills</h2>
          <p className="muted small">
            About {formatRWF(totalMonthly + prepaidBudget)} a month
            {prepaidBudget > 0 && ` (incl. ${formatRWF(prepaidBudget)} electricity budget)`}
          </p>
        </div>
        <button className="btn primary" onClick={() => act({ kind: 'bill' })}>+ Add bill</button>
      </div>
      <div className="table-wrap card">
        <table className="table">
          <thead>
            <tr><th>Bill</th><th>Type</th><th className="r">Amount</th><th>Due</th><th /></tr>
          </thead>
          <tbody>
            {active.length === 0 && <tr><td colSpan={5} className="empty">No active bills.</td></tr>}
            {active.map((b) => {
              const info = categoryInfo(b.category);
              return (
                <tr key={b.id}>
                  <td>
                    <span className="cat-dot" style={{ background: `var(--cat-${b.category})` }} />
                    {info.icon} <strong>{b.name}</strong>
                    <div className="muted small">{info.local} · {b.provider}{b.payTo ? ` · ${b.payTo}` : ''}</div>
                  </td>
                  <td>{FREQUENCIES.find((f) => f.id === b.frequency)?.label}</td>
                  <td className="r">{formatRWF(amountFor(b, current))}{b.frequency === 'variable' && <div className="muted small">estimate</div>}{b.frequency === 'prepaid' && <div className="muted small">budget</div>}</td>
                  <td>{b.frequency === 'prepaid' ? '–' : `Day ${b.dueDay}`}</td>
                  <td className="actions">
                    <button className="btn small ghost" onClick={() => act({ kind: 'bill', billId: b.id })}>Edit</button>
                    <button className="btn small ghost" onClick={() => archive(b.id)} title="Stop tracking from next month (e.g. you moved out)">Archive</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {archived.length > 0 && (
        <section className="card">
          <h3>Archived</h3>
          <ul className="list">
            {archived.map((b) => (
              <li key={b.id}>
                <span>{categoryInfo(b.category).icon} {b.name} <span className="muted small">· ended {b.endPeriod ? periodLabel(b.endPeriod) : ''}</span></span>
                <span className="list-right">
                  <button className="btn small ghost" onClick={() => restore(b.id)}>Restore</button>
                  <button className="btn small danger-ghost" onClick={() => remove(b.id)}>Delete</button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
