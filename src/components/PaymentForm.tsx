import { useState } from 'react';
import { METHODS, addMonths, categoryInfo, formatRWF, periodLabel, periodOf, splitPayment, todayStr } from '../logic';
import type { Bill, Method, Payment, Period } from '../types';
import { Field, Modal, MoneyInput } from './ui';

interface Props {
  bills: Bill[];
  initialBillId: string;
  period: Period;
  suggested?: number;
  existing?: Payment;
  onSave: (payments: Payment[], replaceId?: string) => void;
  onClose: () => void;
}

export function PaymentForm({ bills, initialBillId, period, suggested, existing, onSave, onClose }: Props) {
  const [billId, setBillId] = useState(existing?.billId ?? initialBillId);
  const bill = bills.find((b) => b.id === billId);
  const prepaid = bill?.frequency === 'prepaid';
  const [amount, setAmount] = useState<number | ''>(existing?.amount ?? (suggested && suggested > 0 ? suggested : ''));
  const [date, setDate] = useState(existing?.date ?? todayStr());
  const [forPeriod, setForPeriod] = useState<Period>(existing?.period ?? period);
  const [months, setMonths] = useState(1);
  const [method, setMethod] = useState<Method>(existing?.method ?? 'momo');
  const [reference, setReference] = useState(existing?.reference ?? '');
  const [note, setNote] = useState(existing?.note ?? '');
  const [kwh, setKwh] = useState<string>(existing?.kwh != null ? String(existing.kwh) : '');
  const [token, setToken] = useState(existing?.token ?? '');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bill || amount === '' || amount <= 0) return;
    const base = {
      billId,
      amount,
      date,
      method,
      reference: reference.trim() || undefined,
      note: note.trim() || undefined,
      kwh: prepaid && kwh ? Number(kwh) : undefined,
      token: prepaid && token.trim() ? token.trim() : undefined,
    };
    const p = prepaid ? periodOf(date) : forPeriod;
    if (existing) onSave([{ ...base, id: existing.id, period: p }], existing.id);
    else onSave(splitPayment(base, p, prepaid ? 1 : months));
  };

  const info = bill ? categoryInfo(bill.category) : undefined;
  const title = existing ? 'Edit payment' : prepaid ? 'Buy electricity' : 'Record payment';
  const periodOptions = Array.from({ length: 18 }, (_, i) => addMonths(period, i - 12));

  return (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={submit} className="form">
        <Field label="Bill">
          <select value={billId} onChange={(e) => setBillId(e.target.value)}>
            {bills.map((b) => (
              <option key={b.id} value={b.id}>
                {categoryInfo(b.category).icon} {b.name}
              </option>
            ))}
          </select>
        </Field>
        {bill?.payTo && <p className="muted small">Pay to: <strong>{bill.payTo}</strong></p>}
        <Field label={prepaid ? 'Amount spent' : 'Amount paid'}>
          <MoneyInput value={amount} onChange={setAmount} required />
        </Field>
        <div className="row-2">
          <Field label="Date paid">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </Field>
          {!prepaid && (
            <Field label={months > 1 ? 'Starting month' : 'For month'}>
              <select value={forPeriod} onChange={(e) => setForPeriod(e.target.value)}>
                {periodOptions.map((p) => (
                  <option key={p} value={p}>{periodLabel(p)}</option>
                ))}
              </select>
            </Field>
          )}
        </div>
        {!prepaid && !existing && (
          <Field label="Months covered" hint={months > 1 && amount ? `${formatRWF(Math.floor(Number(amount) / months))} recorded for each month` : 'Paying several months at once? Increase this.'}>
            <input type="number" min={1} max={24} value={months} onChange={(e) => setMonths(Math.max(1, Number(e.target.value) || 1))} />
          </Field>
        )}
        {prepaid && (
          <div className="row-2">
            <Field label="Units (kWh)">
              <input inputMode="decimal" value={kwh} onChange={(e) => setKwh(e.target.value.replace(/[^\d.]/g, ''))} placeholder="e.g. 48.5" />
            </Field>
            <Field label="Token number">
              <input inputMode="numeric" value={token} onChange={(e) => setToken(e.target.value)} placeholder="20-digit token" />
            </Field>
          </div>
        )}
        <div className="row-2">
          <Field label="Paid with">
            <select value={method} onChange={(e) => setMethod(e.target.value as Method)}>
              {METHODS.map((m) => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Reference / transaction ID">
            <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Optional" />
          </Field>
        </div>
        <Field label="Note">
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" />
        </Field>
        <div className="form-actions">
          <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn primary">{info?.icon} Save</button>
        </div>
      </form>
    </Modal>
  );
}
