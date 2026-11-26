import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Status } from '../logic';
import { t, tk } from '../i18n';
import { compressImage, getPhoto, putPhoto } from '../photos';
import { uid } from '../logic';

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeRef.current();
    window.addEventListener('keydown', onKey);
    if (window.matchMedia('(min-width: 641px)').matches) ref.current?.querySelector<HTMLElement>('input:not([type=checkbox]), select, textarea')?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal${wide ? ' wide' : ''}`} role="dialog" aria-modal="true" aria-label={title} ref={ref}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label={t('Close')}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

const STATUS: Record<Status, { label: string; icon: string }> = {
  paid: { label: tk('Paid'), icon: '✓' },
  overdue: { label: tk('Overdue'), icon: '!' },
  partial: { label: tk('Partly paid'), icon: '◐' },
  'due-soon': { label: tk('Due soon'), icon: '⏰' },
  upcoming: { label: tk('Upcoming'), icon: '•' },
  'awaiting-bill': { label: tk('Awaiting bill'), icon: '…' },
};

export function StatusChip({ status }: { status: Status }) {
  const s = STATUS[status];
  return (
    <span className={`chip chip-${status}`}>
      <span aria-hidden="true">{s.icon}</span> {t(s.label)}
    </span>
  );
}

export function Chip({ kind, icon, children }: { kind: 'good' | 'warn' | 'bad' | 'muted'; icon: string; children: ReactNode }) {
  const cls = { good: 'chip-paid', warn: 'chip-due-soon', bad: 'chip-overdue', muted: 'chip-upcoming' }[kind];
  return (
    <span className={`chip ${cls}`}>
      <span aria-hidden="true">{icon}</span> {children}
    </span>
  );
}

/** Numeric input that accepts "150,000" style values. */
export function MoneyInput({ value, onChange, required, label }: { value: number | ''; onChange: (v: number | '') => void; required?: boolean; label?: string }) {
  return (
    <div className="money-input">
      <input
        inputMode="numeric"
        aria-label={label}
        value={value === '' ? '' : value.toLocaleString('en-US')}
        onChange={(e) => {
          const digits = e.target.value.replace(/[^\d]/g, '');
          onChange(digits === '' ? '' : Number(digits));
        }}
        required={required}
        placeholder="0"
      />
      <span>RWF</span>
    </div>
  );
}

export function Progress({ pct, state, color }: { pct: number; state?: 'ok' | 'near' | 'over'; color?: string }) {
  return (
    <div className={`progress${state ? ` ${state}` : ''}`} aria-hidden="true">
      <span style={{ width: `${Math.min(100, Math.max(0, pct))}%`, ...(color ? { background: color } : {}) }} />
    </div>
  );
}

/** Loads a stored photo by id and shows it as a thumbnail that opens full size. */
export function PhotoThumb({ id, onRemove }: { id: string; onRemove?: () => void }) {
  const [src, setSrc] = useState<string>();
  const [big, setBig] = useState(false);
  useEffect(() => {
    let alive = true;
    getPhoto(id).then((p) => alive && setSrc(p?.data)).catch(() => {});
    return () => {
      alive = false;
    };
  }, [id]);
  return (
    <span className="thumb">
      {src ? (
        <button type="button" className="thumb-btn" onClick={() => setBig(true)} aria-label={t('View photo')}>
          <img src={src} alt="" />
        </button>
      ) : (
        <span className="thumb-missing" title={t('Photo not on this device')}>🖼️</span>
      )}
      {onRemove && <button type="button" className="thumb-x" onClick={onRemove} aria-label={t('Remove photo')}>✕</button>}
      {big && src && (
        <div className="lightbox" onClick={() => setBig(false)} role="dialog" aria-label={t('Photo')}>
          <img src={src} alt="" />
        </div>
      )}
    </span>
  );
}

/** Lets the user take or pick photos; stores them and reports their ids. */
export function PhotoPicker({ ids, onChange }: { ids: string[]; onChange: (ids: string[]) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const add = async (files: FileList) => {
    setBusy(true);
    const added: string[] = [];
    for (const f of Array.from(files)) {
      try {
        const id = uid();
        await putPhoto({ id, data: await compressImage(f), created: Date.now() });
        added.push(id);
      } catch {
        /* skip unreadable file */
      }
    }
    setBusy(false);
    onChange([...ids, ...added]);
  };
  return (
    <div className="photos">
      {ids.map((id) => <PhotoThumb key={id} id={id} onRemove={() => onChange(ids.filter((x) => x !== id))} />)}
      <button type="button" className="btn ghost small" onClick={() => ref.current?.click()} disabled={busy}>
        📷 {busy ? t('Saving…') : t('Add photo')}
      </button>
      <input ref={ref} type="file" accept="image/*" multiple hidden onChange={(e) => { if (e.target.files?.length) add(e.target.files); e.target.value = ''; }} />
    </div>
  );
}
