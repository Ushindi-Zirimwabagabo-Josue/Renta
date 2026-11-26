import { useRef, useState } from 'react';
import { todayStr } from '../logic';
import { emptyData, parseData, type Update } from '../store';
import type { Data } from '../types';
import { download } from '../download';
import { Field } from './ui';

export function Settings({ data, update }: { data: Data; update: Update }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState('');
  const s = data.settings;
  const set = (patch: Partial<Data['settings']>) => update((d) => ({ ...d, settings: { ...d.settings, ...patch } }));

  const importFile = async (f: File) => {
    try {
      const parsed = parseData(JSON.parse(await f.text()));
      if (!confirm(`Replace all current data with this backup (${parsed.bills.length} bills, ${parsed.payments.length} payments)?`)) return;
      update(() => parsed);
      setMsg('Backup restored.');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Could not read that file.');
    }
  };

  return (
    <div className="stack narrow">
      <h2>Settings</h2>
      <section className="card form">
        <Field label="Household / your name" hint="Shown on receipts you share">
          <input value={s.householdName} onChange={(e) => set({ householdName: e.target.value })} placeholder="e.g. Kimironko house" />
        </Field>
        <Field label="Remind me this many days before a due date">
          <input type="number" min={0} max={30} value={s.reminderDays} onChange={(e) => set({ reminderDays: Math.max(0, Number(e.target.value) || 0) })} />
        </Field>
      </section>
      <section className="card">
        <h3>Backup</h3>
        <p className="muted small">
          Your data is stored only in this browser on this device. Download a backup regularly, and use it to move your data to another phone or computer.
        </p>
        <div className="row-actions">
          <button className="btn primary" onClick={() => download(`renta-backup-${todayStr()}.json`, JSON.stringify(data, null, 2), 'application/json')}>Download backup</button>
          <button className="btn ghost" onClick={() => fileRef.current?.click()}>Restore from backup</button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) importFile(f); e.target.value = ''; }} />
        </div>
        {msg && <p className="small" role="status">{msg}</p>}
      </section>
      <section className="card">
        <h3>Danger zone</h3>
        <p className="muted small">Erase every bill and payment from this device.</p>
        <button className="btn danger-ghost" onClick={() => confirm('Erase all data? Download a backup first if you may need it.') && update(() => emptyData())}>Erase all data</button>
      </section>
    </div>
  );
}
