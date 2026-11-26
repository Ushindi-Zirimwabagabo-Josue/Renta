import { useState } from 'react';
import { METHODS, addMonths, categoryInfo, formatRWF, isLogBill, periodLabel, periodOf, splitPayment, todayStr, billName } from '../logic';
import { t } from '../i18n';
import { parseSms } from '../sms';
import type { Bill, Method, Payment, Period } from '../types';
import { Field, Modal, MoneyInput, PhotoPicker } from './ui';

interface Props {
  bills: Bill[];
  initialBillId: string;
  period: Period;
  suggested?: number;
  existing?: Payment;
  /** Open with the SMS box expanded */
  pasteMode?: boolean;
  /** Pre-tick "advance" for house help */
  advance?: boolean;
  onSave: (payments: Payment[], replaceId?: string) => void;
  onClose: () => void;
}

export function PaymentForm({ bills, initialBillId, period, suggested, existing, pasteMode, advance, onSave, onClose }: Props) {
  const [billId, setBillId] = useState(existing?.billId ?? initialBillId);
  const bill = bills.find((b) => b.id === billId);
  const log = bill ? isLogBill(bill) : false;
  const isPower = bill?.category === 'electricity' && bill.frequency === 'prepaid';
  const isHelp = bill?.category === 'househelp';
  const [amount, setAmount] = useState<number | ''>(existing?.amount ?? (suggested && suggested > 0 ? suggested : ''));
  const [date, setDate] = useState(existing?.date ?? todayStr());
  const [forPeriod, setForPeriod] = useState<Period>(existing?.period ?? period);
  const [months, setMonths] = useState(1);
  const [method, setMethod] = useState<Method>(existing?.method ?? 'momo');
  const [reference, setReference] = useState(existing?.reference ?? '');
  const [note, setNote] = useState(existing?.note ?? '');
  const [kwh, setKwh] = useState<string>(existing?.kwh != null ? String(existing.kwh) : '');
  const [token, setToken] = useState(existing?.token ?? '');
  const [isAdvance, setIsAdvance] = useState(existing?.isAdvance ?? !!advance);
  const [photoIds, setPhotoIds] = useState<string[]>(existing?.photoIds ?? []);
  const [showSms, setShowSms] = useState(!!pasteMode && !existing);
  const [sms, setSms] = useState('');
  const [smsResult, setSmsResult] = useState('');

  const applySms = (text: string) => {
    setSms(text);
    const p = parseSms(text, bills);
    const found: string[] = [];
    if (p.billId && !existing) {
      setBillId(p.billId);
      found.push(bills.find((b) => b.id === p.billId)?.name ?? '');
    }
    if (p.amount) { setAmount(p.amount); found.push(formatRWF(p.amount)); }
    if (p.date) { setDate(p.date); found.push(p.date); }
    if (p.reference) { setReference(p.reference); found.push(`${t('Ref')} ${p.reference}`); }
    if (p.token) { setToken(p.token); found.push(t('token')); }
    if (p.kwh) { setKwh(String(p.kwh)); found.push(`${p.kwh} kWh`); }
    if (p.method) setMethod(p.method);
    if (p.recipient && !note) setNote(p.recipient);
    setSmsResult(text.trim() ? (found.length ? `${t('Found')}: ${found.filter(Boolean).join(' · ')}` : t('Could not read this message – fill in the details below.')) : '');
  };

  const pasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) applySms(text);
    } catch {
      /* permission denied – user can paste manually */
    }
  };

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
      kwh: isPower && kwh ? Number(kwh) : undefined,
      token: isPower && token.trim() ? token.trim() : undefined,
      isAdvance: isHelp && isAdvance ? true : undefined,
      photoIds: photoIds.length ? photoIds : undefined,
    };
    const p = log ? periodOf(date) : forPeriod;
    if (existing) onSave([{ ...base, id: existing.id, period: p }], existing.id);
    else onSave(splitPayment(base, p, log ? 1 : months));
  };

  const info = bill ? categoryInfo(bill.category) : undefined;
  const title = existing ? t('Edit payment') : isPower ? t('Buy electricity') : log ? t('Record top-up / contribution') : t('Record payment');
  const periodOptions = Array.from({ length: 18 }, (_, i) => addMonths(period, i - 12));

  return (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={submit} className="form">
        {!existing && (
          <div className="sms-box">
            {!showSms ? (
              <button type="button" className="btn ghost small" onClick={() => setShowSms(true)}>📋 {t('Fill from MoMo / Airtel SMS')}</button>
            ) : (
              <>
                <Field label={t('Paste the confirmation SMS')} hint={smsResult || t('MTN MoMo, Airtel Money or REG Cash Power token messages')}>
                  <textarea rows={3} value={sms} onChange={(e) => applySms(e.target.value)} placeholder={t('Paste message here…')} />
                </Field>
                {'clipboard' in navigator && 'readText' in navigator.clipboard && (
                  <button type="button" className="btn ghost small" onClick={pasteFromClipboard}>📋 {t('Paste from clipboard')}</button>
                )}
              </>
            )}
          </div>
        )}
        <Field label={t('Bill')}>
          <select value={billId} onChange={(e) => setBillId(e.target.value)}>
            {bills.map((b) => (
              <option key={b.id} value={b.id}>{categoryInfo(b.category).icon} {billName(b)}</option>
            ))}
          </select>
        </Field>
        {bill?.payTo && <p className="muted small">{t('Pay to')}: <strong>{bill.payTo}</strong></p>}
        <Field label={log ? t('Amount spent') : t('Amount paid')}>
          <MoneyInput value={amount} onChange={setAmount} required label={t('Amount')} />
        </Field>
        <div className="row-2">
          <Field label={t('Date paid')}>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </Field>
          {!log && (
            <Field label={months > 1 ? t('Starting month') : t('For month')}>
              <select value={forPeriod} onChange={(e) => setForPeriod(e.target.value)}>
                {periodOptions.map((p) => <option key={p} value={p}>{periodLabel(p)}</option>)}
              </select>
            </Field>
          )}
        </div>
        {isHelp && (
          <label className="check">
            <input type="checkbox" checked={isAdvance} onChange={(e) => setIsAdvance(e.target.checked)} />
            <span>{t('This is an advance (deducted from this month’s salary)')}</span>
          </label>
        )}
        {!log && !existing && !isAdvance && (
          <Field label={t('Months covered')} hint={months > 1 && amount ? t('{amount} recorded for each month', { amount: formatRWF(Math.floor(Number(amount) / months)) }) : t('Paying several months at once? Increase this.')}>
            <input type="number" min={1} max={24} value={months} onChange={(e) => setMonths(Math.max(1, Number(e.target.value) || 1))} />
          </Field>
        )}
        {isPower && (
          <div className="row-2">
            <Field label={t('Units (kWh)')}>
              <input inputMode="decimal" value={kwh} onChange={(e) => setKwh(e.target.value.replace(/[^\d.]/g, ''))} placeholder="48.5" />
            </Field>
            <Field label={t('Token number')}>
              <input inputMode="numeric" value={token} onChange={(e) => setToken(e.target.value)} placeholder="0000 0000 0000 0000 0000" />
            </Field>
          </div>
        )}
        <div className="row-2">
          <Field label={t('Paid with')}>
            <select value={method} onChange={(e) => setMethod(e.target.value as Method)}>
              {METHODS.map((m) => <option key={m.id} value={m.id}>{t(m.label)}</option>)}
            </select>
          </Field>
          <Field label={t('Reference / transaction ID')}>
            <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder={t('Optional')} />
          </Field>
        </div>
        <Field label={t('Note')}>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('Optional')} />
        </Field>
        <Field label={t('Receipt photos')}>
          <PhotoPicker ids={photoIds} onChange={setPhotoIds} />
        </Field>
        <div className="form-actions">
          <button type="button" className="btn ghost" onClick={onClose}>{t('Cancel')}</button>
          <button type="submit" className="btn primary">{info?.icon} {t('Save')}</button>
        </div>
      </form>
    </Modal>
  );
}
