import { addMonths, arrears, categoryInfo, dateLabel, formatRWF, monthSummary, periodLabel, periodOf, spendingByMonth, sum, type BillMonth, type PrepaidMonth } from '../logic';
import type { Data, Period } from '../types';
import type { Action } from '../App';
import { SpendingChart } from './SpendingChart';
import { StatusChip } from './ui';

interface Props {
  data: Data;
  period: Period;
  today: string;
  setPeriod: (p: Period) => void;
  act: (a: Action) => void;
}

function dueText(bm: BillMonth): string {
  if (bm.status === 'paid') return `Due ${dateLabel(bm.due)}`;
  const d = bm.daysLeft;
  if (d === 0) return 'Due today';
  if (d === 1) return 'Due tomorrow';
  if (d > 1) return `Due in ${d} days · ${dateLabel(bm.due)}`;
  return `${-d} day${d === -1 ? '' : 's'} late · was due ${dateLabel(bm.due)}`;
}

export function Overview({ data, period, today, setPeriod, act }: Props) {
  const s = monthSummary(data, period, today);
  const owed = arrears(data, period, today);
  const owedTotal = sum(owed.map((o) => o.remaining));
  const thisMonth = periodOf(today);
  const alerts = s.rows.filter((r) => r.status === 'overdue' || r.status === 'due-soon');

  if (data.bills.length === 0) {
    return (
      <div className="empty-page">
        <p>You have no bills yet.</p>
        <button className="btn primary" onClick={() => act({ kind: 'bill' })}>Add your first bill</button>
      </div>
    );
  }

  return (
    <div className="stack">
      <div className="month-nav">
        <button className="icon-btn" onClick={() => setPeriod(addMonths(period, -1))} aria-label="Previous month">‹</button>
        <h2>{periodLabel(period)}</h2>
        <button className="icon-btn" onClick={() => setPeriod(addMonths(period, 1))} aria-label="Next month">›</button>
        {period !== thisMonth && <button className="btn ghost small" onClick={() => setPeriod(thisMonth)}>This month</button>}
      </div>

      <div className="tiles">
        <div className="tile accent">
          <span className="tile-label">Still to pay</span>
          <span className="tile-value">{formatRWF(s.remaining)}</span>
          <span className="tile-sub">{s.hasEstimates ? 'includes estimated bills' : `of ${formatRWF(s.expected)} this month`}</span>
        </div>
        <div className="tile">
          <span className="tile-label">Paid toward bills</span>
          <span className="tile-value">{formatRWF(s.paidTowardBills)}</span>
          <span className="tile-sub">{s.rows.filter((r) => r.status === 'paid').length} of {s.rows.length} bills settled</span>
        </div>
        <div className="tile">
          <span className="tile-label">Total spent</span>
          <span className="tile-value">{formatRWF(s.spent)}</span>
          <span className="tile-sub">incl. electricity top-ups</span>
        </div>
        <div className={`tile${owedTotal > 0 ? ' warn' : ''}`}>
          <span className="tile-label">Arrears (earlier months)</span>
          <span className="tile-value">{formatRWF(owedTotal)}</span>
          <span className="tile-sub">{owedTotal > 0 ? `${owed.length} unpaid item${owed.length > 1 ? 's' : ''}` : 'Nothing owed 🎉'}</span>
        </div>
      </div>

      {alerts.length > 0 && (
        <div className="alerts" role="status">
          {alerts.map((a) => (
            <div key={a.bill.id} className={`alert alert-${a.status}`}>
              <span>{categoryInfo(a.bill.category).icon} <strong>{a.bill.name}</strong> – {formatRWF(a.remaining)} · {dueText(a)}</span>
              <button className="btn small primary" onClick={() => act({ kind: 'pay', billId: a.bill.id, period, suggested: a.remaining })}>Pay</button>
            </div>
          ))}
        </div>
      )}

      <div className="cards">
        {s.rows.map((r) => <BillCard key={r.bill.id} r={r} act={act} />)}
        {s.prepaid.map((p) => <PrepaidCard key={p.bill.id} p={p} act={act} />)}
      </div>

      {owed.length > 0 && (
        <section className="card">
          <div className="card-head"><h3>Unpaid from earlier months</h3><strong>{formatRWF(owedTotal)}</strong></div>
          <ul className="list">
            {owed.map((o) => (
              <li key={o.bill.id + o.period}>
                <span>{categoryInfo(o.bill.category).icon} {o.bill.name} <span className="muted">· {periodLabel(o.period)}</span></span>
                <span className="list-right">
                  <strong>{formatRWF(o.remaining)}</strong>
                  <button className="btn small ghost" onClick={() => act({ kind: 'pay', billId: o.bill.id, period: o.period, suggested: o.remaining })}>Pay</button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <SpendingChart months={spendingByMonth(data, period, 12)} current={period} />
    </div>
  );
}

function BillCard({ r, act }: { r: BillMonth; act: (a: Action) => void }) {
  const info = categoryInfo(r.bill.category);
  const pct = r.expected > 0 ? Math.min(100, (r.paid / r.expected) * 100) : r.paid > 0 ? 100 : 0;
  const variable = r.bill.frequency === 'variable';
  return (
    <article className={`card bill-card status-${r.status}`} style={{ ['--cat' as string]: `var(--cat-${r.bill.category})` }}>
      <div className="bill-top">
        <span className="bill-icon" aria-hidden="true">{info.icon}</span>
        <div className="bill-title">
          <h3>{r.bill.name}</h3>
          <span className="muted small">{info.local} · {r.bill.provider}</span>
        </div>
        <StatusChip status={r.status} />
      </div>
      <div className="bill-amounts">
        <div>
          <span className="muted small">{variable && r.estimated ? 'Estimated' : 'Amount'}</span>
          <strong>{formatRWF(r.expected)}</strong>
          {r.charge?.units != null && <span className="muted small"> · {r.charge.units} m³</span>}
        </div>
        <div className="right">
          <span className="muted small">Paid</span>
          <strong>{formatRWF(r.paid)}</strong>
        </div>
      </div>
      <div className="progress" aria-hidden="true"><span style={{ width: `${pct}%` }} /></div>
      <p className="small muted">{r.status === 'awaiting-bill' ? `Enter the bill when it arrives · due ${dateLabel(r.due)}` : dueText(r)}</p>
      <div className="bill-actions">
        {variable && (
          <button className="btn small ghost" onClick={() => act({ kind: 'charge', billId: r.bill.id, period: r.period })}>
            {r.charge ? 'Edit bill amount' : 'Enter bill amount'}
          </button>
        )}
        {r.status !== 'paid' && (
          <button className="btn small primary" onClick={() => act({ kind: 'pay', billId: r.bill.id, period: r.period, suggested: r.remaining })}>
            Pay {r.remaining > 0 && !r.estimated ? formatRWF(r.remaining) : ''}
          </button>
        )}
      </div>
      {r.payments.length > 0 && <PaymentList payments={r.payments} act={act} />}
    </article>
  );
}

function PrepaidCard({ p, act }: { p: PrepaidMonth; act: (a: Action) => void }) {
  const info = categoryInfo(p.bill.category);
  const pct = p.budget > 0 ? Math.min(100, (p.spent / p.budget) * 100) : 0;
  const over = p.budget > 0 && p.spent > p.budget;
  const perKwh = p.kwh > 0 ? p.spent / p.kwh : 0;
  const lastToken = [...p.payments].sort((a, b) => b.date.localeCompare(a.date)).find((x) => x.token);
  return (
    <article className="card bill-card" style={{ ['--cat' as string]: `var(--cat-${p.bill.category})` }}>
      <div className="bill-top">
        <span className="bill-icon" aria-hidden="true">{info.icon}</span>
        <div className="bill-title">
          <h3>{p.bill.name}</h3>
          <span className="muted small">{info.local} · {p.bill.provider} · prepaid</span>
        </div>
        {over && <span className="chip chip-overdue"><span aria-hidden="true">!</span> Over budget</span>}
      </div>
      <div className="bill-amounts">
        <div>
          <span className="muted small">Spent this month</span>
          <strong>{formatRWF(p.spent)}</strong>
        </div>
        <div className="right">
          <span className="muted small">Units bought</span>
          <strong>{p.kwh ? `${+p.kwh.toFixed(1)} kWh` : '–'}</strong>
        </div>
      </div>
      {p.budget > 0 && <div className={`progress${over ? ' over' : ''}`} aria-hidden="true"><span style={{ width: `${pct}%` }} /></div>}
      <p className="small muted">
        {p.budget > 0 ? `Budget ${formatRWF(p.budget)}` : 'No budget set'}
        {perKwh > 0 && ` · avg ${Math.round(perKwh)} RWF/kWh`}
      </p>
      {lastToken && <p className="small token">Last token: <code>{lastToken.token}</code></p>}
      <div className="bill-actions">
        <button className="btn small primary" onClick={() => act({ kind: 'pay', billId: p.bill.id, period: p.period })}>Buy units</button>
      </div>
      {p.payments.length > 0 && <PaymentList payments={p.payments} act={act} />}
    </article>
  );
}

function PaymentList({ payments, act }: { payments: Data['payments']; act: (a: Action) => void }) {
  return (
    <details className="pay-list">
      <summary>{payments.length} payment{payments.length > 1 ? 's' : ''}</summary>
      <ul>
        {[...payments].sort((a, b) => a.date.localeCompare(b.date)).map((x) => (
          <li key={x.id}>
            <button className="link" onClick={() => act({ kind: 'receipt', paymentId: x.id })}>
              {dateLabel(x.date)} · {formatRWF(x.amount)}{x.kwh ? ` · ${x.kwh} kWh` : ''}
            </button>
          </li>
        ))}
      </ul>
    </details>
  );
}
