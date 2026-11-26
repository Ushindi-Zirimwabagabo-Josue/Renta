import { useEffect, useRef, type ReactNode } from 'react';
import type { Status } from '../logic';

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    ref.current?.querySelector<HTMLElement>('input, select, textarea')?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title} ref={ref}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

const STATUS: Record<Status, { label: string; icon: string }> = {
  paid: { label: 'Paid', icon: '✓' },
  overdue: { label: 'Overdue', icon: '!' },
  partial: { label: 'Partly paid', icon: '◐' },
  'due-soon': { label: 'Due soon', icon: '⏰' },
  upcoming: { label: 'Upcoming', icon: '•' },
  'awaiting-bill': { label: 'Awaiting bill', icon: '…' },
};

export function StatusChip({ status }: { status: Status }) {
  const s = STATUS[status];
  return (
    <span className={`chip chip-${status}`}>
      <span aria-hidden="true">{s.icon}</span> {s.label}
    </span>
  );
}

/** Numeric input that accepts "150,000" style values. */
export function MoneyInput({ value, onChange, required, autoFocus }: { value: number | ''; onChange: (v: number | '') => void; required?: boolean; autoFocus?: boolean }) {
  return (
    <div className="money-input">
      <input
        inputMode="numeric"
        value={value === '' ? '' : value.toLocaleString('en-US')}
        onChange={(e) => {
          const digits = e.target.value.replace(/[^\d]/g, '');
          onChange(digits === '' ? '' : Number(digits));
        }}
        required={required}
        autoFocus={autoFocus}
        placeholder="0"
      />
      <span>RWF</span>
    </div>
  );
}
