import { useState } from 'react';
import { CATEGORIES, categoryInfo, uid } from '../logic';
import type { Bill, Category, Frequency, Period } from '../types';
import { MoneyInput } from './ui';

interface Row {
  category: Category;
  on: boolean;
  amount: number | '';
  dueDay: number;
  frequency: Frequency;
  provider: string;
}

const HINTS: Partial<Record<Category, string>> = {
  rent: 'Monthly rent to your landlord',
  water: 'WASAC bill varies – enter your usual amount as an estimate',
  electricity: 'Cash Power is prepaid – set a monthly budget',
  security: 'Monthly umutekano fee to your umudugudu',
  sanitation: 'Monthly isuku fee for waste collection',
};

/** First-run wizard: turn on the five Kigali household bills with their amounts. */
export function Setup({ period, onDone, onSkip }: { period: Period; onDone: (bills: Bill[], name: string) => void; onSkip: () => void }) {
  const [name, setName] = useState('');
  const [rows, setRows] = useState<Row[]>(
    CATEGORIES.filter((c) => c.id !== 'other').map((c) => ({
      category: c.id,
      on: true,
      amount: '',
      dueDay: c.id === 'rent' ? 5 : c.id === 'water' ? 20 : 10,
      frequency: c.defaultFrequency,
      provider: c.defaultProvider,
    })),
  );
  const set = (i: number, patch: Partial<Row>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const finish = () => {
    const bills: Bill[] = rows
      .filter((r) => r.on)
      .map((r) => ({
        id: uid(),
        category: r.category,
        name: categoryInfo(r.category).label,
        provider: r.provider,
        frequency: r.frequency,
        amounts: [{ from: period, amount: r.amount === '' ? 0 : r.amount }],
        dueDay: r.dueDay,
        startPeriod: period,
        active: true,
      }));
    onDone(bills, name.trim());
  };

  return (
    <div className="setup">
      <div className="setup-intro">
        <h2>Murakaza neza! 👋</h2>
        <p>Let's set up your household bills. Turn off any you don't pay (for example if water is included in your rent). You can change everything later.</p>
      </div>
      <label className="field">
        <span className="field-label">Your name or house (optional)</span>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Kimironko house" />
      </label>
      <div className="setup-rows">
        {rows.map((r, i) => {
          const info = categoryInfo(r.category);
          return (
            <div key={r.category} className={`card setup-row${r.on ? '' : ' off'}`}>
              <label className="setup-toggle">
                <input type="checkbox" checked={r.on} onChange={(e) => set(i, { on: e.target.checked })} />
                <span className="bill-icon" aria-hidden="true">{info.icon}</span>
                <span>
                  <strong>{info.label}</strong> <span className="muted">· {info.local}</span>
                  <span className="muted small block">{HINTS[r.category]}</span>
                </span>
              </label>
              {r.on && (
                <div className={`setup-fields${r.frequency === 'prepaid' ? ' two' : ''}`}>
                  <label className="field">
                    <span className="field-label">{r.frequency === 'prepaid' ? 'Monthly budget' : r.frequency === 'variable' ? 'Usual amount' : 'Amount / month'}</span>
                    <MoneyInput value={r.amount} onChange={(v) => set(i, { amount: v })} />
                  </label>
                  {r.frequency !== 'prepaid' && (
                    <label className="field small-field">
                      <span className="field-label">Due day</span>
                      <input type="number" min={1} max={31} value={r.dueDay} onChange={(e) => set(i, { dueDay: Number(e.target.value) || 1 })} />
                    </label>
                  )}
                  <label className="field">
                    <span className="field-label">Paid to</span>
                    <input value={r.provider} onChange={(e) => set(i, { provider: e.target.value })} />
                  </label>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="form-actions">
        <button className="btn ghost" onClick={onSkip}>Skip, I'll add bills myself</button>
        <button className="btn primary" onClick={finish} disabled={!rows.some((r) => r.on)}>Start tracking</button>
      </div>
    </div>
  );
}
