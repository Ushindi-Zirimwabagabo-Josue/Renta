import { useState } from 'react';
import { dateLabel, todayStr, uid, billName } from '../logic';
import { t } from '../i18n';
import { waterIntervals } from '../forecast';
import type { Bill, Data, Reading } from '../types';
import type { Update } from '../store';
import { Field, Modal } from './ui';
import { SimpleBars } from './SimpleBars';

/**
 * Meter readings. Water: cumulative m³ on the meter → usage chart and leak warnings.
 * Electricity: kWh units left on the Cash Power meter → sharper "days left" estimate.
 */
export function ReadingsModal({ bill, data, update, onClose }: { bill: Bill; data: Data; update: Update; onClose: () => void }) {
  const water = bill.category === 'water';
  const readings = data.readings.filter((r) => r.billId === bill.id).sort((a, b) => b.date.localeCompare(a.date));
  const [date, setDate] = useState(todayStr());
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const intervals = water ? waterIntervals(readings) : [];
  const latestSpike = intervals.length > 0 && intervals[intervals.length - 1].spike;

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    const v = Number(value);
    if (!value || Number.isNaN(v)) return;
    if (water) {
      const before = readings.find((r) => r.date <= date);
      if (before && v < before.value) {
        setError(t('This is lower than your reading on {date} ({value} m³). Water meters only go up – please check.', { date: dateLabel(before.date), value: before.value }));
        return;
      }
    }
    const r: Reading = { id: uid(), billId: bill.id, date, value: v };
    update((d) => ({ ...d, readings: [...d.readings, r] }));
    setValue('');
    setError('');
  };
  const remove = (id: string) => update((d) => ({ ...d, readings: d.readings.filter((r) => r.id !== id) }));

  return (
    <Modal title={t('Meter readings – {name}', { name: billName(bill) })} onClose={onClose} wide>
      <p className="muted small">
        {water
          ? t('Write down the number on your water meter from time to time. The app shows how much you use and warns about sudden jumps (a leak or a wrong bill).')
          : t('Check how many units (kWh) are left on your Cash Power meter and note them here. This makes the “days left” estimate more accurate.')}
      </p>
      <form className="row-form" onSubmit={add}>
        <Field label={t('Date')}>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} max={todayStr()} required />
        </Field>
        <Field label={water ? t('Meter reading (m³)') : t('Units left (kWh)')}>
          <input inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value.replace(/[^\d.]/g, ''))} required />
        </Field>
        <button className="btn primary" type="submit">{t('Add')}</button>
      </form>
      {error && <p className="alert alert-overdue small" role="alert">{error}</p>}

      {water && intervals.length > 0 && (
        <section className="sub">
          <h3>{t('Water used per day (m³)')}</h3>
          {latestSpike && (
            <p className="alert alert-due-soon small" role="status">⚠️ {t('Your latest usage is much higher than usual. Check for leaking taps, toilets or pipes, and compare with your WASAC bill.')}</p>
          )}
          <SimpleBars
            ariaLabel={t('Water used per day (m³)')}
            items={intervals.map((iv) => ({
              key: iv.to,
              label: dateLabel(iv.to).split(' ').slice(0, 2).join(' '),
              value: iv.perDay,
              flag: iv.spike,
              tip: `${dateLabel(iv.from)} → ${dateLabel(iv.to)}: ${+iv.m3.toFixed(2)} m³ (${+iv.perDay.toFixed(2)} m³/${t('day')})${iv.spike ? ` – ${t('unusually high')}` : ''}`,
            }))}
          />
        </section>
      )}

      <table className="table">
        <thead>
          <tr><th>{t('Date')}</th><th className="r">{water ? 'm³' : 'kWh'}</th>{water && <th className="r">{t('Used since previous')}</th>}<th /></tr>
        </thead>
        <tbody>
          {readings.length === 0 && <tr><td colSpan={4} className="empty">{t('No readings yet.')}</td></tr>}
          {readings.map((r, i) => {
            const prev = readings[i + 1];
            return (
              <tr key={r.id}>
                <td>{dateLabel(r.date)}</td>
                <td className="r">{r.value}</td>
                {water && <td className="r">{prev ? `${+(r.value - prev.value).toFixed(2)} m³` : '–'}</td>}
                <td className="actions"><button className="btn small danger-ghost" onClick={() => remove(r.id)} aria-label={t('Delete')}>✕</button></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Modal>
  );
}
