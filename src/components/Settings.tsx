import { useEffect, useRef, useState } from 'react';
import { dateLabel, todayStr } from '../logic';
import { LANGS, t } from '../i18n';
import { DEFAULT_TARIFF, emptyData, parseData } from '../data';
import { biometricAvailable, makeLock, registerBiometric } from '../lock';
import { allPhotos, putPhoto, type Photo } from '../photos';
import { clientIdFrom, getDriveState, signOut } from '../sync';
import type { Data, Lang, TariffBlock } from '../types';
import type { Replace, Update } from '../store';
import { download } from '../download';
import { Field, Modal } from './ui';

interface Props {
  data: Data;
  update: Update;
  replace: Replace;
  sync: { status: string; run: () => void };
}

export function Settings({ data, update, replace, sync }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState('');
  const [withPhotos, setWithPhotos] = useState(true);
  const [pinModal, setPinModal] = useState(false);
  const [bio, setBio] = useState(false);
  const s = data.settings;
  const set = (patch: Partial<Data['settings']>) => update((d) => ({ ...d, settings: { ...d.settings, ...patch } }));
  const drive = getDriveState();
  const envClientId = !!import.meta.env.VITE_GOOGLE_CLIENT_ID;

  useEffect(() => {
    biometricAvailable().then(setBio);
  }, []);

  const exportBackup = async () => {
    const photos: Photo[] = withPhotos ? await allPhotos().catch(() => []) : [];
    download(`fagitire-backup-${todayStr()}.json`, JSON.stringify(withPhotos ? { ...data, photos } : data), 'application/json');
  };

  const importFile = async (f: File) => {
    try {
      const raw = JSON.parse(await f.text());
      const parsed = parseData(raw);
      if (!confirm(t('Replace all current data with this backup ({b} bills, {p} payments)?', { b: parsed.bills.length, p: parsed.payments.length }))) return;
      if (Array.isArray(raw.photos)) for (const p of raw.photos as Photo[]) await putPhoto(p).catch(() => {});
      // Keep this device's lock so restoring doesn't lock you out.
      replace({ ...parsed, settings: { ...parsed.settings, lock: data.settings.lock } });
      setMsg(t('Backup restored.'));
    } catch {
      setMsg(t('That file is not a Fagitire backup.'));
    }
  };

  const enableBio = async () => {
    try {
      const id = await registerBiometric(s.householdName);
      set({ lock: { ...s.lock!, credentialId: id } });
      setMsg(t('Fingerprint unlock is on.'));
    } catch {
      setMsg(t('Fingerprint setup was cancelled or is not supported here.'));
    }
  };

  return (
    <div className="stack narrow">
      <h2>{t('Settings')}</h2>
      {msg && <p className="alert alert-info small" role="status">{msg}</p>}

      <section className="card form">
        <Field label={t('Language')}>
          <select value={s.language} onChange={(e) => set({ language: e.target.value as Lang })}>
            {LANGS.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
          </select>
        </Field>
        <Field label={t('Household / your name')} hint={t('Shown on receipts and statements')}>
          <input value={s.householdName} onChange={(e) => set({ householdName: e.target.value })} placeholder={t('e.g. Kimironko house')} />
        </Field>
        <Field label={t('Remind me this many days before a due date')} hint={t('Used for in-app alerts and calendar reminders (Bills → Reminders).')}>
          <input type="number" min={0} max={30} value={s.reminderDays} onChange={(e) => set({ reminderDays: Math.max(0, Number(e.target.value) || 0) })} />
        </Field>
      </section>

      <section className="card">
        <h3>🔒 {t('App lock')}</h3>
        <p className="muted small">{t('Ask for a PIN (or fingerprint) when the app opens, so others using your phone can’t see your finances.')}</p>
        {s.lock ? (
          <>
            <p className="small">✓ {t('PIN lock is on')}{s.lock.credentialId ? ` · ${t('fingerprint enabled')}` : ''}</p>
            <div className="row-actions">
              <button className="btn ghost" onClick={() => setPinModal(true)}>{t('Change PIN')}</button>
              {bio && !s.lock.credentialId && <button className="btn ghost" onClick={enableBio}>👆 {t('Use fingerprint / face')}</button>}
              {s.lock.credentialId && <button className="btn ghost" onClick={() => set({ lock: { ...s.lock!, credentialId: undefined } })}>{t('Turn off fingerprint')}</button>}
              <button className="btn danger-ghost" onClick={() => confirm(t('Turn off the app lock?')) && set({ lock: undefined })}>{t('Turn off lock')}</button>
            </div>
            <Field label={t('Lock again after the app is in the background for')}>
              <select value={s.lockAfterMinutes} onChange={(e) => set({ lockAfterMinutes: Number(e.target.value) })}>
                {[0, 1, 5, 15, 60].map((m) => <option key={m} value={m}>{m === 0 ? t('Immediately') : t('{n} minutes', { n: m })}</option>)}
              </select>
            </Field>
          </>
        ) : (
          <button className="btn primary" onClick={() => setPinModal(true)}>{t('Set a PIN')}</button>
        )}
        <p className="field-hint">{t('The lock hides the app. Your data is still stored unencrypted in this browser, so also keep your phone itself locked.')}</p>
      </section>

      <section className="card">
        <h3>☁️ {t('Google Drive backup & sync')}</h3>
        <p className="muted small">{t('Saves your data in your own Google Drive (in a hidden app folder) and keeps your phone and computer in sync. Nobody else can see it.')}</p>
        {!clientIdFrom(s.googleClientId) ? (
          <>
            <p className="small">{t('This copy of Fagitire has no Google connection set up yet. The person who installed it needs to add a Google OAuth client ID (see the README).')}</p>
            {!envClientId && (
              <Field label={t('Google OAuth client ID (advanced)')}>
                <input value={s.googleClientId ?? ''} onChange={(e) => set({ googleClientId: e.target.value.trim() || undefined })} placeholder="1234-abc.apps.googleusercontent.com" />
              </Field>
            )}
          </>
        ) : (
          <>
            <p className="small">
              {drive.connected ? `✓ ${t('Connected')}` : t('Not connected')}
              {drive.lastSync ? ` · ${t('last synced {when}', { when: new Date(drive.lastSync).toLocaleString() })}` : ''}
              {sync.status && ` · ${sync.status}`}
            </p>
            <div className="row-actions">
              <button className="btn primary" onClick={sync.run}>{drive.connected ? t('Sync now') : t('Connect Google Drive')}</button>
              {drive.connected && <button className="btn ghost" onClick={() => { signOut(); setMsg(t('Disconnected from Google Drive. Your data stays on this device.')); }}>{t('Disconnect')}</button>}
            </div>
            <p className="field-hint">{t('While the app is open it syncs automatically after every change. When you open it later, tap the ☁️ button at the top to sync.')}</p>
          </>
        )}
      </section>

      <section className="card">
        <h3>💾 {t('Backup file')}</h3>
        <p className="muted small">{t('Download a backup file now and then, and use it to move your data to another phone or computer.')}</p>
        <label className="check small">
          <input type="checkbox" checked={withPhotos} onChange={(e) => setWithPhotos(e.target.checked)} />
          <span>{t('Include receipt photos (bigger file)')}</span>
        </label>
        <div className="row-actions">
          <button className="btn primary" onClick={exportBackup}>{t('Download backup')}</button>
          <button className="btn ghost" onClick={() => fileRef.current?.click()}>{t('Restore from backup')}</button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) importFile(f); e.target.value = ''; }} />
        </div>
      </section>

      <TariffEditor blocks={s.tariff.blocks} vat={s.tariff.vatPct} onSave={(blocks, vatPct) => set({ tariff: { blocks, vatPct } })} />

      <section className="card">
        <h3>{t('Danger zone')}</h3>
        <p className="muted small">{t('Erase every bill and payment from this device.')}</p>
        <button className="btn danger-ghost" onClick={() => confirm(t('Erase all data on this device? Download a backup first if you may need it.')) && (signOut(), replace(emptyData()))}>{t('Erase all data')}</button>
      </section>
      <p className="muted small center">Fagitire · {dateLabel(todayStr())}</p>

      {pinModal && (
        <PinSetup
          onClose={() => setPinModal(false)}
          onSave={async (pin) => {
            const lock = await makeLock(pin);
            set({ lock: { ...lock, credentialId: s.lock?.credentialId } });
            setPinModal(false);
            setMsg(t('PIN saved.'));
          }}
        />
      )}
    </div>
  );
}

function PinSetup({ onSave, onClose }: { onSave: (pin: string) => void; onClose: () => void }) {
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const [err, setErr] = useState('');
  return (
    <Modal title={t('Set a PIN')} onClose={onClose}>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          if (a.length < 4) return setErr(t('Use at least 4 digits.'));
          if (a !== b) return setErr(t('The two PINs don’t match.'));
          onSave(a);
        }}
      >
        <Field label={t('New PIN (4–8 digits)')}>
          <input type="password" inputMode="numeric" autoComplete="new-password" value={a} onChange={(e) => setA(e.target.value.replace(/\D/g, '').slice(0, 8))} />
        </Field>
        <Field label={t('Repeat PIN')}>
          <input type="password" inputMode="numeric" autoComplete="new-password" value={b} onChange={(e) => setB(e.target.value.replace(/\D/g, '').slice(0, 8))} />
        </Field>
        {err && <p className="small err" role="alert">{err}</p>}
        <p className="field-hint">{t('If you forget your PIN you can only reset the app, which erases data on this device. Keep a backup or turn on Google Drive sync.')}</p>
        <div className="form-actions">
          <button type="button" className="btn ghost" onClick={onClose}>{t('Cancel')}</button>
          <button className="btn primary">{t('Save PIN')}</button>
        </div>
      </form>
    </Modal>
  );
}

function TariffEditor({ blocks, vat, onSave }: { blocks: TariffBlock[]; vat: number; onSave: (b: TariffBlock[], vat: number) => void }) {
  const [rows, setRows] = useState(blocks);
  const [v, setV] = useState(vat);
  const dirty = JSON.stringify(rows) !== JSON.stringify(blocks) || v !== vat;
  let lower = 0;
  return (
    <details className="card">
      <summary><strong>⚡ {t('Electricity tariff')}</strong> <span className="muted small">{t('used for “how much to buy” suggestions')}</span></summary>
      <p className="muted small">{t('REG domestic prices per kWh before VAT. Check REG’s current tariff and update these if they change.')}</p>
      <table className="table compact">
        <thead><tr><th>{t('kWh per month')}</th><th>{t('Up to')}</th><th className="r">{t('RWF / kWh')}</th></tr></thead>
        <tbody>
          {rows.map((r, i) => {
            const from = lower;
            lower = r.upTo ?? lower;
            return (
              <tr key={i}>
                <td>{from}+</td>
                <td>
                  {r.upTo == null ? '∞' : (
                    <input className="mini" inputMode="numeric" value={r.upTo} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, upTo: Number(e.target.value.replace(/\D/g, '')) || 0 } : x)))} aria-label={t('Up to')} />
                  )}
                </td>
                <td className="r"><input className="mini" inputMode="decimal" value={r.price} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, price: Number(e.target.value.replace(/[^\d.]/g, '')) || 0 } : x)))} aria-label={t('RWF / kWh')} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <Field label={t('VAT %')}><input className="mini" inputMode="numeric" value={v} onChange={(e) => setV(Number(e.target.value.replace(/\D/g, '')) || 0)} /></Field>
      <div className="row-actions">
        <button className="btn primary small" disabled={!dirty} onClick={() => onSave(rows, v)}>{t('Save tariff')}</button>
        <button className="btn ghost small" onClick={() => { setRows(DEFAULT_TARIFF.blocks); setV(DEFAULT_TARIFF.vatPct); }}>{t('Reset to defaults')}</button>
      </div>
    </details>
  );
}
