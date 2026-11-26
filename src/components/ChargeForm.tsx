import { useState } from 'react';
import { periodLabel, uid, billName } from '../logic';
import { t } from '../i18n';
import type { Bill, Charge, Period } from '../types';
import { Field, Modal, MoneyInput, PhotoPicker } from './ui';

interface Props {
  bill: Bill;
  period: Period;
  existing?: Charge;
  onSave: (c: Charge) => void;
  onDelete?: () => void;
  onClose: () => void;
}

/** Enter the actual bill for a month on a 'variable' bill (e.g. the WASAC water bill). */
export function ChargeForm({ bill, period, existing, onSave, onDelete, onClose }: Props) {
  const [amount, setAmount] = useState<number | ''>(existing?.amount ?? '');
  const [units, setUnits] = useState(existing?.units != null ? String(existing.units) : '');
  const [note, setNote] = useState(existing?.note ?? '');
  const [photoIds, setPhotoIds] = useState<string[]>(existing?.photoIds ?? []);
  return (
    <Modal title={t('{name} bill – {month}', { name: billName(bill), month: periodLabel(period) })} onClose={onClose}>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          if (amount === '') return;
          onSave({ id: existing?.id ?? uid(), billId: bill.id, period, amount, units: units ? Number(units) : undefined, note: note.trim() || undefined, photoIds: photoIds.length ? photoIds : undefined });
        }}
      >
        <Field label={t('Amount on the bill')}>
          <MoneyInput value={amount} onChange={setAmount} required label={t('Amount')} />
        </Field>
        <Field label={t('Consumption (m³ / units)')} hint={t('Optional – from your meter or bill')}>
          <input inputMode="decimal" value={units} onChange={(e) => setUnits(e.target.value.replace(/[^\d.]/g, ''))} />
        </Field>
        <Field label={t('Note')}>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('Optional')} />
        </Field>
        <Field label={t('Photo of the bill')}>
          <PhotoPicker ids={photoIds} onChange={setPhotoIds} />
        </Field>
        <div className="form-actions">
          {onDelete && <button type="button" className="btn danger-ghost" onClick={onDelete}>{t('Remove bill')}</button>}
          <button type="button" className="btn ghost" onClick={onClose}>{t('Cancel')}</button>
          <button type="submit" className="btn primary">{t('Save')}</button>
        </div>
      </form>
    </Modal>
  );
}
