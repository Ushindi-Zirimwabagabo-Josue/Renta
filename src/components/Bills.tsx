import { useState } from 'react';
import { FREQUENCIES, amountFor, categoryInfo, dateLabel, formatRWF, isLogBill, periodLabel, todayStr, billName } from '../logic';
import { t } from '../i18n';
import { allEvents, billEvent, googleCalendarUrl, toIcs, type CalEvent } from '../calendar';
import type { Data, Period } from '../types';
import type { Action } from '../App';
import type { Update } from '../store';
import { download } from '../download';
import { Modal } from './ui';
import { dueDayLabel } from './BillForm';

export function Bills({ data, update, current, act }: { data: Data; update: Update; current: Period; act: (a: Action) => void }) {
  const [cal, setCal] = useState<CalEvent[] | null>(null);
  const active = data.bills.filter((b) => b.active);
  const archived = data.bills.filter((b) => !b.active);

  const archive = (id: string) => update((d) => ({ ...d, bills: d.bills.map((b) => (b.id === id ? { ...b, active: false, endPeriod: current } : b)) }));
  const restore = (id: string) => update((d) => ({ ...d, bills: d.bills.map((b) => (b.id === id ? { ...b, active: true, endPeriod: undefined } : b)) }));
  const remove = (id: string) => {
    const n = data.payments.filter((p) => p.billId === id).length;
    if (!confirm(n ? t('Delete this bill and its {n} payment records? This cannot be undone.', { n }) : t('Delete this bill? This cannot be undone.'))) return;
    update((d) => ({
      ...d,
      bills: d.bills.filter((b) => b.id !== id),
      payments: d.payments.filter((p) => p.billId !== id),
      charges: d.charges.filter((c) => c.billId !== id),
      readings: d.readings.filter((r) => r.billId !== id),
    }));
  };

  const monthly = active.filter((b) => !isLogBill(b)).reduce((a, b) => a + amountFor(b, current), 0);
  const budgets = active.filter(isLogBill).reduce((a, b) => a + amountFor(b, current), 0);
  const events = allEvents(data);

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h2>{t('Your bills')}</h2>
          <p className="muted small">
            {t('About {amount} a month', { amount: formatRWF(monthly + budgets) })}
            {budgets > 0 && ` (${t('incl. {amount} in top-up budgets', { amount: formatRWF(budgets) })})`}
          </p>
        </div>
        <div className="row-actions tight">
          <button className="btn ghost" onClick={() => setCal(events)} disabled={!events.length}>📅 {t('Reminders')}</button>
          <button className="btn primary" onClick={() => act({ kind: 'bill' })}>+ {t('Add bill')}</button>
        </div>
      </div>
      <div className="table-wrap card">
        <table className="table">
          <thead>
            <tr><th>{t('Bill')}</th><th>{t('Type')}</th><th className="r">{t('Amount')}</th><th>{t('Due')}</th><th /></tr>
          </thead>
          <tbody>
            {active.length === 0 && <tr><td colSpan={5} className="empty">{t('No active bills.')}</td></tr>}
            {active.map((b) => {
              const info = categoryInfo(b.category);
              const ev = billEvent(b, data);
              return (
                <tr key={b.id}>
                  <td>
                    <span className="cat-dot" style={{ background: `var(--cat-${b.category})` }} />
                    {info.icon} <strong>{billName(b)}</strong>
                    <div className="muted small">{info.local} · {b.provider}{b.payTo ? ` · ${b.payTo}` : ''}</div>
                    {b.lease && (
                      <div className="muted small">
                        {b.lease.end && `${t('Lease ends')} ${dateLabel(b.lease.end)}`}
                        {b.lease.deposit ? ` · ${t('Deposit')} ${formatRWF(b.lease.deposit)}` : ''}
                        {b.lease.landlordPhone ? <> · <a href={`tel:${b.lease.landlordPhone}`}>{b.lease.landlordName || b.lease.landlordPhone}</a></> : ''}
                      </div>
                    )}
                  </td>
                  <td>{t(FREQUENCIES.find((f) => f.id === b.frequency)?.label ?? '')}</td>
                  <td className="r">
                    {formatRWF(amountFor(b, current))}
                    {b.frequency === 'variable' && <div className="muted small">{t('estimate')}</div>}
                    {isLogBill(b) && <div className="muted small">{t('budget')}</div>}
                  </td>
                  <td>{isLogBill(b) ? '–' : <span title={dueDayLabel(b.category)}>{t('Day {n}', { n: b.dueDay })}</span>}</td>
                  <td className="actions">
                    {ev && <button className="btn small ghost" onClick={() => setCal([ev])} aria-label={t('Add to calendar')} title={t('Add to calendar')}>📅</button>}
                    {(b.category === 'water' || (b.category === 'electricity' && b.frequency === 'prepaid')) && (
                      <button className="btn small ghost" onClick={() => act({ kind: 'readings', billId: b.id })} title={t('Meter readings')} aria-label={t('Meter readings')}>📟</button>
                    )}
                    <button className="btn small ghost" onClick={() => act({ kind: 'bill', billId: b.id })}>{t('Edit')}</button>
                    <button className="btn small ghost" onClick={() => archive(b.id)} title={t('Stop tracking from next month (e.g. you moved out)')}>{t('Archive')}</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {archived.length > 0 && (
        <section className="card">
          <h3>{t('Archived')}</h3>
          <ul className="list">
            {archived.map((b) => (
              <li key={b.id}>
                <span>{categoryInfo(b.category).icon} {billName(b)} <span className="muted small">· {t('ended {month}', { month: b.endPeriod ? periodLabel(b.endPeriod) : '' })}</span></span>
                <span className="list-right">
                  <button className="btn small ghost" onClick={() => restore(b.id)}>{t('Restore')}</button>
                  <button className="btn small danger-ghost" onClick={() => remove(b.id)}>{t('Delete')}</button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {cal && <CalendarModal events={cal} onClose={() => setCal(null)} />}
    </div>
  );
}

function CalendarModal({ events, onClose }: { events: CalEvent[]; onClose: () => void }) {
  const one = events.length === 1;
  return (
    <Modal title={one ? t('Add to calendar') : t('Reminders in your phone calendar')} onClose={onClose}>
      <p className="muted small">
        {t('Your phone calendar will remind you before each due date – even when Fagitire is closed. Monthly bills repeat every month automatically.')}
      </p>
      <div className="row-actions">
        <button className="btn primary" onClick={() => download(one ? `fagitire-${events[0].uid.split('@')[0]}.ics` : `fagitire-reminders-${todayStr()}.ics`, toIcs(events), 'text/calendar')}>
          📥 {one ? t('Download calendar event') : t('Download all {n} reminders', { n: events.length })}
        </button>
      </div>
      <p className="field-hint">{t('iPhone: open the file and tap “Add all”. Android / computer: open it with Google Calendar or Outlook, or use the Google Calendar links below.')}</p>
      <ul className="list">
        {events.map((e) => (
          <li key={e.uid}>
            <span>{e.title}<span className="muted small block">{dateLabel(e.date)}{e.rrule ? ` · ${t('every month')}` : ''}</span></span>
            <a className="btn small ghost" href={googleCalendarUrl(e)} target="_blank" rel="noopener noreferrer">Google Calendar ↗</a>
          </li>
        ))}
      </ul>
    </Modal>
  );
}
