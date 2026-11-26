import { useMemo, useState } from 'react';
import { CATEGORIES, addMonths, categoryInfo, categoryLabel, dateLabel, formatRWF, methodLabel, paymentsCsv, periodLabel, periodOf, sum, todayStr, billName } from '../logic';
import { monthName, t, tn } from '../i18n';
import { billAverages, monthChanges, yearTotals } from '../money';
import type { Category, Data } from '../types';
import type { Action } from '../App';
import { download } from '../download';
import { Chip } from './ui';

type Sub = 'insights' | 'history' | 'statement';

export function Reports({ data, act, today }: { data: Data; act: (a: Action) => void; today: string }) {
  const [sub, setSub] = useState<Sub>('insights');
  return (
    <div className="stack">
      <div className="segmented no-print" role="tablist">
        {(['insights', 'history', 'statement'] as Sub[]).map((s) => (
          <button key={s} role="tab" aria-selected={sub === s} className={sub === s ? 'on' : ''} onClick={() => setSub(s)}>
            {s === 'insights' ? `💡 ${t('Insights')}` : s === 'history' ? `📜 ${t('History')}` : `🖨️ ${t('Yearly statement')}`}
          </button>
        ))}
      </div>
      {sub === 'insights' && <Insights data={data} today={today} />}
      {sub === 'history' && <History data={data} act={act} />}
      {sub === 'statement' && <Statement data={data} today={today} />}
    </div>
  );
}

function years(data: Data, today: string): number[] {
  const ys = new Set([Number(today.slice(0, 4)), ...data.payments.map((p) => Number(p.period.slice(0, 4)))]);
  return [...ys].sort((a, b) => b - a);
}

/* ---------------- Insights ---------------- */

function Insights({ data, today }: { data: Data; today: string }) {
  const [period, setPeriod] = useState(periodOf(today));
  const [year, setYear] = useState(Number(today.slice(0, 4)));
  const changes = monthChanges(data, period);
  const avgs = billAverages(data, period, 6);
  const yt = yearTotals(data, year);
  const prev = addMonths(period, -1);
  const usedCats = CATEGORIES.filter((c) => yt.byCategory[c.id] > 0);
  const monthsWithData = yt.byMonth.filter((x) => x > 0).length;

  return (
    <>
      <section className="card">
        <div className="card-head">
          <div>
            <h3>{t('Compared with last month')}</h3>
            {period === periodOf(today) && <p className="muted small">{t('This month so far')}</p>}
          </div>
          <div className="month-nav small-nav">
            <button className="icon-btn" onClick={() => setPeriod(addMonths(period, -1))} aria-label={t('Previous month')}>‹</button>
            <span>{periodLabel(period)}</span>
            <button className="icon-btn" onClick={() => setPeriod(addMonths(period, 1))} aria-label={t('Next month')}>›</button>
          </div>
        </div>
        {changes.length === 0 ? (
          <p className="empty">{t('No big changes compared with {month}.', { month: periodLabel(prev) })}</p>
        ) : (
          <ul className="list">
            {changes.map((c) => (
              <li key={c.category}>
                <span>
                  {categoryInfo(c.category).icon}{' '}
                  {c.pct > 0
                    ? t('{name} up {pct}% vs {month}', { name: categoryLabel(c.category), pct: Math.round(c.pct), month: periodLabel(prev) })
                    : t('{name} down {pct}% vs {month}', { name: categoryLabel(c.category), pct: Math.round(-c.pct), month: periodLabel(prev) })}
                </span>
                <span className="list-right">
                  <span className="muted small">{formatRWF(c.before)} →</span>
                  <strong>{formatRWF(c.now)}</strong>
                  {c.pct > 0 ? <Chip kind="warn" icon="▲">{Math.round(c.pct)}%</Chip> : <Chip kind="good" icon="▼">{Math.round(-c.pct)}%</Chip>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card">
        <h3>{t('Average per month (last 6 months)')}</h3>
        {avgs.length === 0 ? (
          <p className="empty">{t('Not enough payments yet.')}</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>{t('Bill')}</th><th className="r">{t('Average / month')}</th><th className="r">{t('Per year')}</th></tr></thead>
              <tbody>
                {avgs.map((a) => (
                  <tr key={a.bill.id}>
                    <td>{categoryInfo(a.bill.category).icon} {billName(a.bill)} <span className="muted small">({t('{n} mo.', { n: a.months })})</span></td>
                    <td className="r">{formatRWF(a.avg)}</td>
                    <td className="r muted">{formatRWF(a.avg * 12)}</td>
                  </tr>
                ))}
                <tr className="total-row">
                  <td><strong>{t('Total')}</strong></td>
                  <td className="r"><strong>{formatRWF(sum(avgs.map((a) => a.avg)))}</strong></td>
                  <td className="r"><strong>{formatRWF(sum(avgs.map((a) => a.avg)) * 12)}</strong></td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card">
        <div className="card-head">
          <h3>{t('Year totals')}</h3>
          <select value={year} onChange={(e) => setYear(Number(e.target.value))} aria-label={t('Year')}>
            {years(data, today).map((y) => <option key={y}>{y}</option>)}
          </select>
        </div>
        <div className="tiles three">
          <div className="tile"><span className="tile-label">{t('Spent')}</span><span className="tile-value">{formatRWF(yt.total)}</span><span className="tile-sub">{monthsWithData ? t('≈ {amount} a month', { amount: formatRWF(yt.total / monthsWithData) }) : '–'}</span></div>
          <div className="tile"><span className="tile-label">{t('Income')}</span><span className="tile-value">{formatRWF(yt.income)}</span><span className="tile-sub">&nbsp;</span></div>
          <div className="tile"><span className="tile-label">{t('Saved')}</span><span className="tile-value">{formatRWF(yt.saved)}</span><span className="tile-sub">&nbsp;</span></div>
        </div>
        {usedCats.length > 0 && (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>{t('Category')}</th><th className="r">{t('Total')}</th><th className="r">{t('Share')}</th></tr></thead>
              <tbody>
                {usedCats.sort((a, b) => yt.byCategory[b.id] - yt.byCategory[a.id]).map((c) => (
                  <tr key={c.id}>
                    <td><span className="cat-dot" style={{ background: `var(--cat-${c.id})` }} />{c.icon} {t(c.label)}</td>
                    <td className="r">{formatRWF(yt.byCategory[c.id])}</td>
                    <td className="r muted">{Math.round((yt.byCategory[c.id] / yt.total) * 100)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

/* ---------------- History ---------------- */

function History({ data, act }: { data: Data; act: (a: Action) => void }) {
  const [cat, setCat] = useState<Category | 'all'>('all');
  const [year, setYear] = useState<string>('all');
  const [q, setQ] = useState('');
  const billById = useMemo(() => new Map(data.bills.map((b) => [b.id, b])), [data.bills]);
  const ys = [...new Set(data.payments.map((p) => p.date.slice(0, 4)))].sort().reverse();

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
    <>
      <div className="page-head">
        <p className="muted small">{tn(rows.length, '1 payment', '{n} payments')} · {formatRWF(sum(rows.map((r) => r.amount)))}</p>
        <button className="btn ghost" disabled={!data.payments.length} onClick={() => download(`fagitire-payments-${todayStr()}.csv`, paymentsCsv(data), 'text/csv')}>
          {t('Export CSV')}
        </button>
      </div>
      <div className="filters">
        <select value={cat} onChange={(e) => setCat(e.target.value as Category | 'all')} aria-label={t('Category')}>
          <option value="all">{t('All categories')}</option>
          {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.icon} {t(c.label)}</option>)}
        </select>
        <select value={year} onChange={(e) => setYear(e.target.value)} aria-label={t('Year')}>
          <option value="all">{t('All years')}</option>
          {ys.map((y) => <option key={y}>{y}</option>)}
        </select>
        <input type="search" placeholder={t('Search reference, note, token…')} value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="card table-wrap">
        <table className="table">
          <thead>
            <tr><th>{t('Date')}</th><th>{t('Bill')}</th><th>{t('For')}</th><th>{t('Method')}</th><th className="r">{t('Amount')}</th></tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={5} className="empty">{t('No payments found.')}</td></tr>}
            {rows.map((p) => {
              const b = billById.get(p.billId);
              return (
                <tr key={p.id} className="clickable" onClick={() => act({ kind: 'receipt', paymentId: p.id })}>
                  <td>{dateLabel(p.date)}</td>
                  <td>
                    {b ? categoryInfo(b.category).icon : ''} {b?.name ?? t('(deleted bill)')} {p.photoIds?.length ? '📷' : ''}
                    {(p.reference || p.token) && <div className="muted small">{p.token ? `${t('Token')} ${p.token}` : `${t('Ref')} ${p.reference}`}</div>}
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
    </>
  );
}

/* ---------------- Yearly statement (print / PDF) ---------------- */

function Statement({ data, today }: { data: Data; today: string }) {
  const [year, setYear] = useState(Number(today.slice(0, 4)));
  const [cat, setCat] = useState<Category | 'all'>('all');
  const billById = new Map(data.bills.map((b) => [b.id, b]));
  const rows = data.payments
    .filter((p) => p.period.startsWith(`${year}-`))
    .filter((p) => cat === 'all' || billById.get(p.billId)?.category === cat)
    .sort((a, b) => a.date.localeCompare(b.date));
  const byCat = CATEGORIES.map((c) => ({ c, total: sum(rows.filter((p) => billById.get(p.billId)?.category === c.id).map((p) => p.amount)) })).filter((x) => x.total > 0);
  const total = sum(rows.map((r) => r.amount));
  const byMonth = Array.from({ length: 12 }, (_, m) => sum(rows.filter((p) => Number(p.period.slice(5, 7)) === m + 1).map((p) => p.amount)));
  return (
    <>
      <div className="page-head no-print">
        <div className="filters">
          <select value={year} onChange={(e) => setYear(Number(e.target.value))} aria-label={t('Year')}>
            {years(data, today).map((y) => <option key={y}>{y}</option>)}
          </select>
          <select value={cat} onChange={(e) => setCat(e.target.value as Category | 'all')} aria-label={t('Category')}>
            <option value="all">{t('All categories')}</option>
            {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.icon} {t(c.label)}</option>)}
          </select>
        </div>
        <button className="btn primary" onClick={() => window.print()}>🖨️ {t('Print / save as PDF')}</button>
      </div>
      <p className="muted small no-print">{t('Tip: in the print window choose “Save as PDF” to get a file you can send to your landlord or umudugudu.')}</p>
      <article className="statement card print-area">
        <header className="st-head">
          <div>
            <h2>{t('Payment statement {year}', { year })}</h2>
            <p>{data.settings.householdName || ''}{cat !== 'all' && ` · ${categoryLabel(cat)}`}</p>
          </div>
          <div className="st-brand"><span className="logo">F</span> Fagitire</div>
        </header>
        <div className="st-summary">
          <div><span>{t('Total paid')}</span><strong>{formatRWF(total)}</strong></div>
          <div><span>{t('Payments')}</span><strong>{rows.length}</strong></div>
          <div><span>{t('Generated')}</span><strong>{dateLabel(today)}</strong></div>
        </div>
        {byCat.length > 1 && (
          <table className="table compact">
            <thead><tr><th>{t('Category')}</th><th className="r">{t('Total')}</th></tr></thead>
            <tbody>{byCat.map(({ c, total: v }) => <tr key={c.id}><td>{t(c.label)}</td><td className="r">{formatRWF(v)}</td></tr>)}</tbody>
          </table>
        )}
        <table className="table compact">
          <thead><tr>{byMonth.map((_, m) => <th key={m} className="r">{monthName(m, true)}</th>)}</tr></thead>
          <tbody><tr>{byMonth.map((v, m) => <td key={m} className="r">{v ? v.toLocaleString('en-US') : '–'}</td>)}</tr></tbody>
        </table>
        <table className="table compact">
          <thead>
            <tr><th>{t('Date')}</th><th>{t('Bill')}</th><th>{t('For')}</th><th>{t('Method')}</th><th>{t('Reference')}</th><th className="r">{t('Amount')}</th></tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={6} className="empty">{t('No payments in {year}.', { year })}</td></tr>}
            {rows.map((p) => {
              const b = billById.get(p.billId);
              return (
                <tr key={p.id}>
                  <td>{dateLabel(p.date)}</td>
                  <td>{b ? `${billName(b)}${b.provider ? ` (${b.provider})` : ''}` : t('(deleted bill)')}</td>
                  <td>{periodLabel(p.period, true)}</td>
                  <td>{methodLabel(p.method)}</td>
                  <td>{p.reference ?? p.token ?? ''}</td>
                  <td className="r">{formatRWF(p.amount)}</td>
                </tr>
              );
            })}
            {rows.length > 0 && <tr className="total-row"><td colSpan={5}><strong>{t('Total')}</strong></td><td className="r"><strong>{formatRWF(total)}</strong></td></tr>}
          </tbody>
        </table>
        <p className="st-foot">{t('Statement produced with Fagitire from records kept by the household. Transaction references can be checked with the mobile-money provider.')}</p>
      </article>
    </>
  );
}
