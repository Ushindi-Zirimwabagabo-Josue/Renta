import { useState } from 'react';
import { periodLabel, uid } from '../logic';
import type { Bill, Charge, Period } from '../types';
import { Field, Modal, MoneyInput } from './ui';

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
  return (
    <Modal title={`${bill.name} bill – ${periodLabel(period)}`} onClose={onClose}>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          if (amount === '') return;
          onSave({ id: existing?.id ?? uid(), billId: bill.id, period, amount, units: units ? Number(units) : undefined, note: note.trim() || undefined });
        }}
      >
        <Field label="Amount on the bill">
          <MoneyInput value={amount} onChange={setAmount} required />
        </Field>
        <Field label="Consumption (m³ / units)" hint="Optional – from your meter or bill">
          <input inputMode="decimal" value={units} onChange={(e) => setUnits(e.target.value.replace(/[^\d.]/g, ''))} />
        </Field>
        <Field label="Note">
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" />
        </Field>
        <div className="form-actions">
          {onDelete && <button type="button" className="btn danger-ghost" onClick={onDelete}>Remove bill</button>}
          <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn primary">Save</button>
        </div>
      </form>
    </Modal>
  );
}
