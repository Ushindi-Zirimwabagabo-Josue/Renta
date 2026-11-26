import { useState } from 'react';
import { DEFAULT_ON, SETUP_CATEGORIES, categoryInfo, uid } from '../logic';
import { LANGS, t } from '../i18n';
import type { Bill, Category, Frequency, Lang, Period } from '../types';
import { MoneyInput } from './ui';

interface Row {
  category: Category;
  on: boolean;
  amount: number | '';
  dueDay: number;
  frequency: Frequency;
  provider: string;
}

/** First-run wizard: pick the household bills you pay and their amounts. */
export function Setup({ period, lang, setLang, onDone, onSkip }: { period: Period; lang: Lang; setLang: (l: Lang) => void; onDone: (bills: Bill[], name: string) => void; onSkip: () => void }) {
  const [name, setName] = useState('');
  const [rows, setRows] = useState<Row[]>(
    SETUP_CATEGORIES.map((c) => {
      const info = categoryInfo(c);
      return { category: c, on: DEFAULT_ON.includes(c), amount: '', dueDay: info.defaultDueDay, frequency: info.defaultFrequency, provider: info.defaultProvider };
    }),
  );
  const set = (i: number, patch: Partial<Row>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const finish = () => {
    const bills: Bill[] = rows
      .filter((r) => r.on)
      .map((r) => ({
        id: uid(),
        category: r.category,
        name: t(categoryInfo(r.category).label),
        provider: t(r.provider),
        frequency: r.frequency,
        amounts: [{ from: period, amount: r.amount === '' ? 0 : r.amount }],
        dueDay: r.dueDay,
        startPeriod: period,
        active: true,
      }));
    onDone(bills, name.trim());
  };

  const amountLabel = (r: Row) =>
    r.frequency === 'prepaid' || r.frequency === 'occasional' ? t('Monthly budget') : r.frequency === 'variable' ? t('Usual amount') : r.category === 'househelp' ? t('Salary per month') : t('Amount / month');

  return (
    <div className="setup">
      <div className="lang-pick" role="radiogroup" aria-label={t('Language')}>
        {LANGS.map((l) => (
          <button key={l.id} role="radio" aria-checked={lang === l.id} className={lang === l.id ? 'on' : ''} onClick={() => setLang(l.id)}>{l.label}</button>
        ))}
      </div>
      <div className="setup-intro">
        <h2>{t('Welcome!')} 👋</h2>
        <p>{t('Tick the bills your household pays and enter the amounts. Untick anything you don’t pay (for example if water is included in your rent). You can change everything later.')}</p>
      </div>
      <label className="field">
        <span className="field-label">{t('Your name or house (optional)')}</span>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('e.g. Kimironko house')} />
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
                  <strong>{t(info.label)}</strong> <span className="muted">· {info.local}</span>
                  <span className="muted small block">{t(info.hint)}</span>
                </span>
              </label>
              {r.on && (
                <div className={`setup-fields${r.frequency === 'fixed' || r.frequency === 'variable' ? '' : ' two'}`}>
                  <label className="field">
                    <span className="field-label">{amountLabel(r)}</span>
                    <MoneyInput value={r.amount} onChange={(v) => set(i, { amount: v })} label={`${t(info.label)} – ${amountLabel(r)}`} />
                  </label>
                  {(r.frequency === 'fixed' || r.frequency === 'variable') && (
                    <label className="field small-field">
                      <span className="field-label">{r.category === 'tv' || r.category === 'internet' ? t('Renewal day') : r.category === 'househelp' ? t('Pay day') : t('Due day')}</span>
                      <input type="number" min={1} max={31} value={r.dueDay} onChange={(e) => set(i, { dueDay: Number(e.target.value) || 1 })} />
                    </label>
                  )}
                  <label className="field">
                    <span className="field-label">{r.category === 'househelp' ? t('Employee name') : t('Paid to')}</span>
                    <input value={t(r.provider)} onChange={(e) => set(i, { provider: e.target.value })} />
                  </label>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="form-actions">
        <button className="btn ghost" onClick={onSkip}>{t('Skip, I’ll add bills myself')}</button>
        <button className="btn primary" onClick={finish} disabled={!rows.some((r) => r.on)}>{t('Start tracking')}</button>
      </div>
    </div>
  );
}
