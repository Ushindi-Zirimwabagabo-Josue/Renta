import { useState } from 'react';
import { addMonths, arrears, categoryInfo, categoryLabel, daysUntil, dateLabel, formatRWF, monthSummary, periodLabel, periodOf, spendingByMonth, sum, type BillMonth, type PrepaidMonth, billName } from '../logic';
import { t, tn } from '../i18n';
import { nextKwhPrice, powerForecast, refillForecast } from '../forecast';
import { budgetLines, cashFlow, incomeMonth } from '../money';
import type { Data, Period } from '../types';
import type { Action } from '../App';
import { SpendingChart } from './SpendingChart';
import { Chip, Progress, StatusChip } from './ui';

interface Props {
  data: Data;
  period: Period;
  today: string;
  setPeriod: (p: Period) => void;
  act: (a: Action) => void;
}

function dueText(bm: BillMonth): string {
  if (bm.status === 'paid') return t('Due {date}', { date: dateLabel(bm.due) });
  const d = bm.daysLeft;
  if (d === 0) return t('Due today');
  if (d === 1) return t('Due tomorrow');
  if (d > 1) return t('Due in {n} days · {date}', { n: d, date: dateLabel(bm.due) });
  return t('{n} days late · was due {date}', { n: -d, date: dateLabel(bm.due) });
}

interface AlertItem {
  key: string;
  level: 'overdue' | 'due-soon';
  text: string;
  action?: { label: string; run: () => void };
}

export function Overview({ data, period, today, setPeriod, act }: Props) {
  const s = monthSummary(data, period, today);
  const owed = arrears(data, period, today);
  const owedTotal = sum(owed.map((o) => o.remaining));
  const thisMonth = periodOf(today);
  const isNow = period === thisMonth;
  const flow = cashFlow(data, period);
  const inc = incomeMonth(data, period);
  const tracksIncome = data.incomeSources.length > 0 || data.incomes.length > 0;

  if (data.bills.length === 0) {
    return (
      <div className="empty-page">
        <p>{t('You have no bills yet.')}</p>
        <button className="btn primary" onClick={() => act({ kind: 'bill' })}>{t('Add your first bill')}</button>
      </div>
    );
  }

  const alerts: AlertItem[] = [];
  for (const r of s.rows) {
    if (r.status === 'overdue' || r.status === 'due-soon') {
      alerts.push({
        key: r.bill.id,
        level: r.status,
        text: `${categoryInfo(r.bill.category).icon} ${billName(r.bill)} – ${formatRWF(r.remaining)} · ${dueText(r)}`,
        action: { label: t('Pay'), run: () => act({ kind: 'pay', billId: r.bill.id, period, suggested: r.remaining }) },
      });
    }
  }
  if (isNow) {
    for (const b of data.bills.filter((x) => x.active)) {
      const l = b.lease;
      if (l?.end) {
        const d = daysUntil(today, l.end);
        if (d >= 0 && d <= 60) alerts.push({ key: `lease-${b.id}`, level: d <= 30 ? 'overdue' : 'due-soon', text: `🏠 ${t('Your lease for {name} ends in {n} days ({date}).', { name: billName(b), n: d, date: dateLabel(l.end) })}` });
      }
      if (l?.nextIncrease) {
        const d = daysUntil(today, l.nextIncrease);
        if (d >= 0 && d <= 30) alerts.push({ key: `inc-${b.id}`, level: 'due-soon', text: `🏠 ${t('Rent for {name} goes up on {date}.', { name: billName(b), date: dateLabel(l.nextIncrease) })} ${l.increaseNote ?? ''}`, action: { label: t('Update amount'), run: () => act({ kind: 'bill', billId: b.id }) } });
      }
      if (b.category === 'electricity' && b.frequency === 'prepaid') {
        const f = powerForecast(data, b, today);
        if (f && f.daysLeft <= 3) alerts.push({ key: `pw-${b.id}`, level: f.daysLeft <= 1 ? 'overdue' : 'due-soon', text: `⚡ ${t('Electricity may run out in about {n} days.', { n: f.daysLeft })}`, action: { label: t('Buy units'), run: () => act({ kind: 'pay', billId: b.id, period }) } });
      }
      if (b.category === 'gas') {
        const f = refillForecast(data, b, today);
        if (f && f.daysLeft <= 5) alerts.push({ key: `gas-${b.id}`, level: f.daysLeft <= 0 ? 'overdue' : 'due-soon', text: `🔥 ${f.daysLeft <= 0 ? t('Your gas cylinder is probably almost empty.') : t('Gas refill likely needed in about {n} days.', { n: f.daysLeft })}` });
      }
    }
  }
  for (const line of budgetLines(data, period)) {
    if (line.state === 'ok') continue;
    const name = line.category === 'total' ? t('Total budget') : categoryLabel(line.category);
    alerts.push({
      key: `bud-${line.category}`,
      level: line.state === 'over' ? 'overdue' : 'due-soon',
      text: `📊 ${line.state === 'over' ? t('{name}: over budget by {amount}', { name, amount: formatRWF(line.spent - line.budget) }) : t('{name}: {pct}% of budget used', { name, pct: Math.round(line.pct) })}`,
    });
  }

  return (
    <div className="stack">
      <div className="month-nav">
        <button className="icon-btn" onClick={() => setPeriod(addMonths(period, -1))} aria-label={t('Previous month')}>‹</button>
        <h2>{periodLabel(period)}</h2>
        <button className="icon-btn" onClick={() => setPeriod(addMonths(period, 1))} aria-label={t('Next month')}>›</button>
        {!isNow && <button className="btn ghost small" onClick={() => setPeriod(thisMonth)}>{t('This month')}</button>}
        <button className="btn ghost small push" onClick={() => act({ kind: 'pay', billId: '', period, paste: true })}>📋 {t('Paste SMS')}</button>
      </div>

      <div className="tiles">
        <div className="tile accent">
          <span className="tile-label">{t('Still to pay')}</span>
          <span className="tile-value">{formatRWF(s.remaining)}</span>
          <span className="tile-sub">{s.hasEstimates ? t('includes estimated bills') : t('of {amount} this month', { amount: formatRWF(s.expected) })}</span>
        </div>
        <div className="tile">
          <span className="tile-label">{t('Total spent')}</span>
          <span className="tile-value">{formatRWF(s.spent)}</span>
          <span className="tile-sub">{t('{n} of {m} bills settled', { n: s.rows.filter((r) => r.status === 'paid').length, m: s.rows.length })}</span>
        </div>
        {tracksIncome ? (
          <div className={`tile${flow.left < 0 ? ' warn' : ''}`}>
            <span className="tile-label">{t('Left this month')}</span>
            <span className="tile-value">{formatRWF(flow.left)}</span>
            <span className="tile-sub">
              {t('Income {income} − spent − saved {saved}', { income: formatRWF(flow.income), saved: formatRWF(flow.saved) })}
              {inc.expectedMore > 0 && ` · ${t('{amount} more expected', { amount: formatRWF(inc.expectedMore) })}`}
            </span>
          </div>
        ) : (
          <button className="tile tile-cta" onClick={() => act({ kind: 'goto', tab: 'money' })}>
            <span className="tile-label">{t('Left this month')}</span>
            <span className="tile-value">＋</span>
            <span className="tile-sub">{t('Add your income to see what’s left')}</span>
          </button>
        )}
        <div className={`tile${owedTotal > 0 ? ' warn' : ''}`}>
          <span className="tile-label">{t('Arrears (earlier months)')}</span>
          <span className="tile-value">{formatRWF(owedTotal)}</span>
          <span className="tile-sub">{owedTotal > 0 ? tn(owed.length, '1 unpaid item', '{n} unpaid items') : t('Nothing owed 🎉')}</span>
        </div>
      </div>

      {alerts.length > 0 && (
        <div className="alerts" role="status">
          {alerts.map((a) => (
            <div key={a.key} className={`alert alert-${a.level}`}>
              <span>{a.text}</span>
              {a.action && <button className="btn small primary" onClick={a.action.run}>{a.action.label}</button>}
            </div>
          ))}
        </div>
      )}

      <div className="cards">
        {s.rows.map((r) => <BillCard key={r.bill.id} r={r} act={act} />)}
        {s.prepaid.map((p) => <LogCard key={p.bill.id} p={p} data={data} today={today} isNow={isNow} act={act} />)}
      </div>

      {owed.length > 0 && (
        <section className="card">
          <div className="card-head"><h3>{t('Unpaid from earlier months')}</h3><strong>{formatRWF(owedTotal)}</strong></div>
          <ul className="list">
            {owed.map((o) => (
              <li key={o.bill.id + o.period}>
                <span>{categoryInfo(o.bill.category).icon} {billName(o.bill)} <span className="muted">· {periodLabel(o.period)}</span></span>
                <span className="list-right">
                  <strong>{formatRWF(o.remaining)}</strong>
                  <button className="btn small ghost" onClick={() => act({ kind: 'pay', billId: o.bill.id, period: o.period, suggested: o.remaining })}>{t('Pay')}</button>
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

function CardTop({ icon, name, sub, chip }: { icon: string; name: string; sub: string; chip?: React.ReactNode }) {
  return (
    <div className="bill-top">
      <span className="bill-icon" aria-hidden="true">{icon}</span>
      <div className="bill-title">
        <h3>{name}</h3>
        <span className="muted small">{sub}</span>
      </div>
      {chip}
    </div>
  );
}

function BillCard({ r, act }: { r: BillMonth; act: (a: Action) => void }) {
  const info = categoryInfo(r.bill.category);
  const pct = r.expected > 0 ? (r.paid / r.expected) * 100 : r.paid > 0 ? 100 : 0;
  const variable = r.bill.frequency === 'variable';
  const help = r.bill.category === 'househelp';
  const advances = sum(r.payments.filter((p) => p.isAdvance).map((p) => p.amount));
  return (
    <article className={`card bill-card status-${r.status}`} style={{ ['--cat' as string]: `var(--cat-${r.bill.category})` }}>
      <CardTop icon={info.icon} name={billName(r.bill)} sub={[info.local, r.bill.provider].filter(Boolean).join(' · ')} chip={<StatusChip status={r.status} />} />
      <div className="bill-amounts">
        <div>
          <span className="muted small">{variable && r.estimated ? t('Estimated') : help ? t('Salary') : t('Amount')}</span>
          <strong>{formatRWF(r.expected)}</strong>
          {r.charge?.units != null && <span className="muted small"> · {r.charge.units} m³</span>}
        </div>
        <div className="right">
          <span className="muted small">{t('Paid')}</span>
          <strong>{formatRWF(r.paid)}</strong>
        </div>
      </div>
      <Progress pct={pct} />
      {help && advances > 0 && (
        <p className="small">{t('Advances: {adv} · balance to pay: {bal}', { adv: formatRWF(advances), bal: formatRWF(r.remaining) })}</p>
      )}
      <p className="small muted">{r.status === 'awaiting-bill' ? t('Enter the bill when it arrives · due {date}', { date: dateLabel(r.due) }) : dueText(r)}</p>
      <div className="bill-actions">
        {variable && (
          <button className="btn small ghost" onClick={() => act({ kind: 'charge', billId: r.bill.id, period: r.period })}>
            {r.charge ? t('Edit bill amount') : t('Enter bill amount')}
          </button>
        )}
        {r.bill.category === 'water' && <button className="btn small ghost" onClick={() => act({ kind: 'readings', billId: r.bill.id })}>📟 {t('Meter')}</button>}
        {help && r.status !== 'paid' && (
          <button className="btn small ghost" onClick={() => act({ kind: 'pay', billId: r.bill.id, period: r.period, advance: true })}>{t('Give advance')}</button>
        )}
        {r.status !== 'paid' && (
          <button className="btn small primary" onClick={() => act({ kind: 'pay', billId: r.bill.id, period: r.period, suggested: r.remaining })}>
            {t('Pay')} {r.remaining > 0 && !r.estimated ? formatRWF(r.remaining) : ''}
          </button>
        )}
      </div>
      {r.payments.length > 0 && <PaymentList payments={r.payments} act={act} />}
    </article>
  );
}

function LogCard({ p, data, today, isNow, act }: { p: PrepaidMonth; data: Data; today: string; isNow: boolean; act: (a: Action) => void }) {
  const info = categoryInfo(p.bill.category);
  const isPower = p.bill.category === 'electricity' && p.bill.frequency === 'prepaid';
  const isGas = p.bill.category === 'gas';
  const occasional = p.bill.frequency === 'occasional';
  const over = p.budget > 0 && p.spent > p.budget;
  const perKwh = p.kwh > 0 ? p.spent / p.kwh : 0;
  const lastToken = [...p.payments].sort((a, b) => b.date.localeCompare(a.date)).find((x) => x.token);
  const power = isPower && isNow ? powerForecast(data, p.bill, today) : null;
  const gas = isGas && isNow ? refillForecast(data, p.bill, today) : null;
  const [showPrice, setShowPrice] = useState(false);
  const sub = [info.local, p.bill.provider || t(occasional ? 'Occasional' : 'Prepaid / top-up')].join(' · ');
  return (
    <article className="card bill-card" style={{ ['--cat' as string]: `var(--cat-${p.bill.category})` }}>
      <CardTop icon={info.icon} name={billName(p.bill)} sub={sub} chip={over ? <Chip kind="bad" icon="!">{t('Over budget')}</Chip> : undefined} />
      <div className="bill-amounts">
        <div>
          <span className="muted small">{t('Spent this month')}</span>
          <strong>{formatRWF(p.spent)}</strong>
        </div>
        {isPower ? (
          <div className="right">
            <span className="muted small">{t('Units bought')}</span>
            <strong>{p.kwh ? `${+p.kwh.toFixed(1)} kWh` : '–'}</strong>
          </div>
        ) : (
          <div className="right">
            <span className="muted small">{occasional ? t('Contributions') : t('Top-ups')}</span>
            <strong>{p.payments.length}</strong>
          </div>
        )}
      </div>
      {p.budget > 0 && <Progress pct={(p.spent / p.budget) * 100} state={over ? 'over' : undefined} />}
      <p className="small muted">
        {p.budget > 0 ? t('Budget {amount}', { amount: formatRWF(p.budget) }) : t('No budget set')}
        {perKwh > 0 && ` · ${t('avg {n} RWF/kWh', { n: Math.round(perKwh) })}`}
      </p>

      {power && (
        <div className="forecast">
          <p>
            <strong>{power.daysLeft <= 0 ? t('Units probably finished') : t('≈ {n} days of power left', { n: power.daysLeft })}</strong>
            {power.daysLeft > 0 && <span className="muted small"> · {t('until about {date}', { date: dateLabel(power.runOutDate) })}</span>}
          </p>
          <p className="small muted">
            {t('You use about {n} kWh a day', { n: +power.perDay.toFixed(1) })} · {t('≈ {n} kWh left', { n: +power.remaining.toFixed(1) })}
            {power.basis === 'purchases' && ` (${t('estimated from your purchases')})`}
          </p>
          {power.toMonthEndKwh > 0 && (
            <p className="small">💡 {t('Buy about {kwh} kWh (≈ {cost}) to last until the end of the month.', { kwh: power.toMonthEndKwh, cost: formatRWF(power.toMonthEndCost) })}</p>
          )}
          <button className="link small" onClick={() => setShowPrice((x) => !x)}>{showPrice ? t('Hide price details') : t('Why does the price per kWh change?')}</button>
          {showPrice && <TariffInfo data={data} monthKwh={power.monthKwh} payments={data.payments.filter((x) => x.billId === p.bill.id && x.kwh)} />}
        </div>
      )}
      {isPower && isNow && !power && <p className="small muted">{t('Log two or more purchases with kWh to see how many days of power you have left.')}</p>}

      {gas && (
        <div className="forecast">
          <p>
            <strong>{gas.daysLeft <= 0 ? t('Refill due now') : t('Next refill in about {n} days', { n: gas.daysLeft })}</strong>
            <span className="muted small"> · {dateLabel(gas.nextRefill)}</span>
          </p>
          <p className="small muted">{t('A cylinder lasts you about {n} days · last refill {date} · ≈ {cost} per refill', { n: Math.round(gas.avgDays), date: dateLabel(gas.lastRefill), cost: formatRWF(gas.avgCost) })}</p>
        </div>
      )}
      {isGas && isNow && !gas && <p className="small muted">{t('Log two or more refills to learn how long a cylinder lasts.')}</p>}

      {lastToken && <p className="small token">{t('Last token')}: <code>{lastToken.token}</code></p>}
      <div className="bill-actions">
        {isPower && <button className="btn small ghost" onClick={() => act({ kind: 'readings', billId: p.bill.id })}>📟 {t('Meter')}</button>}
        <button className="btn small primary" onClick={() => act({ kind: 'pay', billId: p.bill.id, period: p.period })}>
          {isPower ? t('Buy units') : isGas ? t('Log refill') : occasional ? t('Add contribution') : t('Add top-up')}
        </button>
      </div>
      {p.payments.length > 0 && <PaymentList payments={p.payments} act={act} />}
    </article>
  );
}

function TariffInfo({ data, monthKwh, payments }: { data: Data; monthKwh: number; payments: Data['payments'] }) {
  const tariff = data.settings.tariff;
  let lower = 0;
  const recent = [...payments].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);
  return (
    <div className="tariff">
      <p className="small">
        {t('REG charges more per kWh the more you buy in a month. You have bought {n} kWh this month, so your next kWh costs about {price} RWF.', { n: +monthKwh.toFixed(1), price: Math.round(nextKwhPrice(tariff, monthKwh)) })}
      </p>
      <table className="table compact">
        <thead><tr><th>{t('kWh bought this month')}</th><th className="r">{t('RWF per kWh (incl. VAT)')}</th></tr></thead>
        <tbody>
          {tariff.blocks.map((b, i) => {
            const label = b.upTo == null ? t('above {n}', { n: lower }) : `${lower}–${b.upTo}`;
            const active = monthKwh >= lower && (b.upTo == null || monthKwh < b.upTo);
            lower = b.upTo ?? lower;
            return (
              <tr key={i} className={active ? 'hl' : ''}>
                <td>{label}{active && ` ← ${t('you are here')}`}</td>
                <td className="r">{Math.round(b.price * (1 + tariff.vatPct / 100))}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {recent.length > 0 && (
        <ul className="plain small">
          {recent.map((x) => (
            <li key={x.id}>{dateLabel(x.date)}: {formatRWF(x.amount)} → {x.kwh} kWh = <strong>{Math.round(x.amount / (x.kwh || 1))} RWF/kWh</strong></li>
          ))}
        </ul>
      )}
      <p className="field-hint">{t('Tariff rates can be updated in Settings if REG changes them.')}</p>
    </div>
  );
}

function PaymentList({ payments, act }: { payments: Data['payments']; act: (a: Action) => void }) {
  return (
    <details className="pay-list">
      <summary>{tn(payments.length, '1 payment', '{n} payments')}</summary>
      <ul>
        {[...payments].sort((a, b) => a.date.localeCompare(b.date)).map((x) => (
          <li key={x.id}>
            <button className="link" onClick={() => act({ kind: 'receipt', paymentId: x.id })}>
              {dateLabel(x.date)} · {formatRWF(x.amount)}{x.kwh ? ` · ${x.kwh} kWh` : ''}{x.isAdvance ? ` · ${t('advance')}` : ''}{x.photoIds?.length ? ' · 📷' : ''}{x.note ? ` · ${x.note}` : ''}
            </button>
          </li>
        ))}
      </ul>
    </details>
  );
}
