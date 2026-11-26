import { useState } from 'react';
import { CATEGORIES, FREQUENCIES, addMonths, amountFor, categoryInfo, periodLabel, uid, billName } from '../logic';
import { t } from '../i18n';
import type { Bill, Category, Frequency, Lease, Period } from '../types';
import { Field, Modal, MoneyInput } from './ui';

interface Props {
  existing?: Bill;
  currentPeriod: Period;
  onSave: (b: Bill) => void;
  onClose: () => void;
}

export function dueDayLabel(c: Category): string {
  if (c === 'tv' || c === 'internet') return t('Renewal day of month');
  if (c === 'househelp') return t('Pay day of month');
  return t('Due day of month');
}

export function BillForm({ existing, currentPeriod, onSave, onClose }: Props) {
  const [category, setCategory] = useState<Category>(existing?.category ?? 'rent');
  const [name, setName] = useState(existing?.name ?? '');
  const [provider, setProvider] = useState(existing?.provider ?? t(categoryInfo('rent').defaultProvider));
  const [frequency, setFrequency] = useState<Frequency>(existing?.frequency ?? 'fixed');
  const currentAmount = existing ? amountFor(existing, currentPeriod) : '';
  const [amount, setAmount] = useState<number | ''>(currentAmount);
  const [effectiveFrom, setEffectiveFrom] = useState<Period>(currentPeriod);
  const [dueDay, setDueDay] = useState(existing?.dueDay ?? 5);
  const [payTo, setPayTo] = useState(existing?.payTo ?? '');
  const [startPeriod, setStartPeriod] = useState<Period>(existing?.startPeriod ?? currentPeriod);
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [lease, setLease] = useState<Lease>(existing?.lease ?? {});
  const setL = (patch: Partial<Lease>) => setLease((l) => ({ ...l, ...patch }));

  const amountChanged = existing && amount !== '' && amount !== currentAmount;

  const pickCategory = (c: Category) => {
    setCategory(c);
    if (!existing) {
      const info = categoryInfo(c);
      setProvider(t(info.defaultProvider));
      setFrequency(info.defaultFrequency);
      setDueDay(info.defaultDueDay);
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = amount === '' ? 0 : amount;
    let amounts = existing?.amounts ?? [];
    if (!existing) amounts = [{ from: startPeriod, amount: amt }];
    else if (amountChanged) amounts = [...amounts.filter((a) => a.from !== effectiveFrom), { from: effectiveFrom, amount: amt }];
    const cleanLease = Object.fromEntries(Object.entries(lease).filter(([, v]) => v !== '' && v != null)) as Lease;
    onSave({
      id: existing?.id ?? uid(),
      category,
      name: name.trim() || t(categoryInfo(category).label),
      provider: provider.trim(),
      frequency,
      amounts,
      dueDay: Math.min(31, Math.max(1, dueDay)),
      payTo: payTo.trim() || undefined,
      notes: notes.trim() || undefined,
      startPeriod,
      endPeriod: existing?.endPeriod,
      active: existing?.active ?? true,
      lease: category === 'rent' && Object.keys(cleanLease).length ? cleanLease : undefined,
    });
  };

  const amountLabel = frequency === 'fixed' ? (category === 'househelp' ? t('Salary per month') : t('Amount per month')) : frequency === 'variable' ? t('Usual amount (estimate)') : t('Monthly budget');
  const startOptions = Array.from({ length: 37 }, (_, i) => addMonths(currentPeriod, i - 24));
  if (!startOptions.includes(startPeriod)) startOptions.unshift(startPeriod);
  const hasDue = frequency === 'fixed' || frequency === 'variable';

  return (
    <Modal title={existing ? t('Edit {name}', { name: billName(existing) }) : t('Add a bill')} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <div className="cat-picker" role="radiogroup" aria-label={t('Category')}>
          {CATEGORIES.map((c) => (
            <button type="button" key={c.id} role="radio" aria-checked={category === c.id} className={category === c.id ? 'on' : ''} onClick={() => pickCategory(c.id)}>
              <span aria-hidden="true">{c.icon}</span>
              <span>{t(c.label)}</span>
              <small>{c.local}</small>
            </button>
          ))}
        </div>
        <div className="row-2">
          <Field label={t('Name')}>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t(categoryInfo(category).label)} />
          </Field>
          <Field label={category === 'househelp' ? t('Employee name') : t('Provider / paid to')}>
            <input value={provider} onChange={(e) => setProvider(e.target.value)} />
          </Field>
        </div>
        <Field label={t('Type')} hint={t(FREQUENCIES.find((f) => f.id === frequency)?.hint ?? '')}>
          <select value={frequency} onChange={(e) => setFrequency(e.target.value as Frequency)}>
            {FREQUENCIES.map((f) => <option key={f.id} value={f.id}>{t(f.label)}</option>)}
          </select>
        </Field>
        <div className="row-2">
          <Field label={amountLabel}>
            <MoneyInput value={amount} onChange={setAmount} required={frequency === 'fixed'} label={amountLabel} />
          </Field>
          {hasDue && (
            <Field label={dueDayLabel(category)}>
              <input type="number" min={1} max={31} value={dueDay} onChange={(e) => setDueDay(Number(e.target.value) || 1)} />
            </Field>
          )}
        </div>
        {amountChanged && (
          <Field label={t('New amount applies from')} hint={t('Earlier months keep the old amount, so your history stays correct.')}>
            <select value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)}>
              {startOptions.filter((p) => p >= startPeriod).map((p) => <option key={p} value={p}>{periodLabel(p)}</option>)}
            </select>
          </Field>
        )}
        <Field label={t('Payment details')} hint={t('e.g. MoMo number, meter number, account or decoder number')}>
          <input value={payTo} onChange={(e) => setPayTo(e.target.value)} placeholder={t('Optional')} />
        </Field>

        {category === 'rent' && (
          <fieldset className="fieldset">
            <legend>🏠 {t('Lease details')}</legend>
            <div className="row-2">
              <Field label={t('Lease start')}>
                <input type="date" value={lease.start ?? ''} onChange={(e) => setL({ start: e.target.value })} />
              </Field>
              <Field label={t('Lease end')}>
                <input type="date" value={lease.end ?? ''} onChange={(e) => setL({ end: e.target.value })} />
              </Field>
            </div>
            <Field label={t('Deposit (caution) paid')}>
              <MoneyInput value={lease.deposit ?? ''} onChange={(v) => setL({ deposit: v === '' ? undefined : v })} label={t('Deposit (caution) paid')} />
            </Field>
            <div className="row-2">
              <Field label={t('Landlord name')}>
                <input value={lease.landlordName ?? ''} onChange={(e) => setL({ landlordName: e.target.value })} />
              </Field>
              <Field label={t('Landlord phone')}>
                <input type="tel" value={lease.landlordPhone ?? ''} onChange={(e) => setL({ landlordPhone: e.target.value })} placeholder="07…" />
              </Field>
            </div>
            <div className="row-2">
              <Field label={t('Next rent increase')}>
                <input type="date" value={lease.nextIncrease ?? ''} onChange={(e) => setL({ nextIncrease: e.target.value })} />
              </Field>
              <Field label={t('Increase details')}>
                <input value={lease.increaseNote ?? ''} onChange={(e) => setL({ increaseNote: e.target.value })} placeholder={t('e.g. +10% agreed')} />
              </Field>
            </div>
          </fieldset>
        )}

        <Field label={t('Tracking starts')} hint={t('Pick an earlier month to track unpaid balances (arrears) from then.')}>
          <select value={startPeriod} onChange={(e) => setStartPeriod(e.target.value)}>
            {startOptions.map((p) => <option key={p} value={p}>{periodLabel(p)}</option>)}
          </select>
        </Field>
        <Field label={t('Notes')}>
          <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t('Optional')} />
        </Field>
        <div className="form-actions">
          <button type="button" className="btn ghost" onClick={onClose}>{t('Cancel')}</button>
          <button type="submit" className="btn primary">{t('Save bill')}</button>
        </div>
      </form>
    </Modal>
  );
}
