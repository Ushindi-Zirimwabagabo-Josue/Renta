import { useState } from 'react';
import { CATEGORIES, FREQUENCIES, addMonths, amountFor, categoryInfo, periodLabel, uid } from '../logic';
import type { Bill, Category, Frequency, Period } from '../types';
import { Field, Modal, MoneyInput } from './ui';

interface Props {
  existing?: Bill;
  currentPeriod: Period;
  onSave: (b: Bill) => void;
  onClose: () => void;
}

export function BillForm({ existing, currentPeriod, onSave, onClose }: Props) {
  const [category, setCategory] = useState<Category>(existing?.category ?? 'rent');
  const [name, setName] = useState(existing?.name ?? '');
  const [provider, setProvider] = useState(existing?.provider ?? categoryInfo('rent').defaultProvider);
  const [frequency, setFrequency] = useState<Frequency>(existing?.frequency ?? 'fixed');
  const currentAmount = existing ? amountFor(existing, currentPeriod) : '';
  const [amount, setAmount] = useState<number | ''>(currentAmount);
  const [effectiveFrom, setEffectiveFrom] = useState<Period>(currentPeriod);
  const [dueDay, setDueDay] = useState(existing?.dueDay ?? 5);
  const [payTo, setPayTo] = useState(existing?.payTo ?? '');
  const [startPeriod, setStartPeriod] = useState<Period>(existing?.startPeriod ?? currentPeriod);
  const [notes, setNotes] = useState(existing?.notes ?? '');

  const amountChanged = existing && amount !== '' && amount !== currentAmount;

  const pickCategory = (c: Category) => {
    setCategory(c);
    if (!existing) {
      const info = categoryInfo(c);
      setProvider(info.defaultProvider);
      setFrequency(info.defaultFrequency);
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = amount === '' ? 0 : amount;
    let amounts = existing?.amounts ?? [];
    if (!existing) amounts = [{ from: startPeriod, amount: amt }];
    else if (amountChanged) amounts = [...amounts.filter((a) => a.from !== effectiveFrom), { from: effectiveFrom, amount: amt }];
    onSave({
      id: existing?.id ?? uid(),
      category,
      name: name.trim() || categoryInfo(category).label,
      provider: provider.trim(),
      frequency,
      amounts,
      dueDay: Math.min(31, Math.max(1, dueDay)),
      payTo: payTo.trim() || undefined,
      notes: notes.trim() || undefined,
      startPeriod,
      endPeriod: existing?.endPeriod,
      active: existing?.active ?? true,
    });
  };

  const amountLabel = frequency === 'fixed' ? 'Amount per month' : frequency === 'variable' ? 'Usual amount (estimate)' : 'Monthly budget';
  const startOptions = Array.from({ length: 37 }, (_, i) => addMonths(currentPeriod, i - 24));
  if (!startOptions.includes(startPeriod)) startOptions.unshift(startPeriod);

  return (
    <Modal title={existing ? `Edit ${existing.name}` : 'Add a bill'} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <div className="cat-picker" role="radiogroup" aria-label="Category">
          {CATEGORIES.map((c) => (
            <button type="button" key={c.id} role="radio" aria-checked={category === c.id} className={category === c.id ? 'on' : ''} onClick={() => pickCategory(c.id)}>
              <span aria-hidden="true">{c.icon}</span>
              <span>{c.label}</span>
              <small>{c.local}</small>
            </button>
          ))}
        </div>
        <div className="row-2">
          <Field label="Name">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder={categoryInfo(category).label} />
          </Field>
          <Field label="Provider / paid to">
            <input value={provider} onChange={(e) => setProvider(e.target.value)} />
          </Field>
        </div>
        <Field label="Type" hint={FREQUENCIES.find((f) => f.id === frequency)?.hint}>
          <select value={frequency} onChange={(e) => setFrequency(e.target.value as Frequency)}>
            {FREQUENCIES.map((f) => (
              <option key={f.id} value={f.id}>{f.label}</option>
            ))}
          </select>
        </Field>
        <div className="row-2">
          <Field label={amountLabel}>
            <MoneyInput value={amount} onChange={setAmount} required={frequency === 'fixed'} />
          </Field>
          {frequency !== 'prepaid' && (
            <Field label="Due day of month">
              <input type="number" min={1} max={31} value={dueDay} onChange={(e) => setDueDay(Number(e.target.value) || 1)} />
            </Field>
          )}
        </div>
        {amountChanged && (
          <Field label="New amount applies from" hint="Earlier months keep the old amount, so your history stays correct.">
            <select value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)}>
              {startOptions.filter((p) => p >= startPeriod).map((p) => (
                <option key={p} value={p}>{periodLabel(p)}</option>
              ))}
            </select>
          </Field>
        )}
        <Field label="Payment details" hint="e.g. landlord's MoMo number, meter number, account">
          <input value={payTo} onChange={(e) => setPayTo(e.target.value)} placeholder="Optional" />
        </Field>
        <Field label="Tracking starts" hint="Pick an earlier month to track unpaid balances (arrears) from then.">
          <select value={startPeriod} onChange={(e) => setStartPeriod(e.target.value)}>
            {startOptions.map((p) => (
              <option key={p} value={p}>{periodLabel(p)}</option>
            ))}
          </select>
        </Field>
        <Field label="Notes">
          <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
        </Field>
        <div className="form-actions">
          <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn primary">Save bill</button>
        </div>
      </form>
    </Modal>
  );
}
