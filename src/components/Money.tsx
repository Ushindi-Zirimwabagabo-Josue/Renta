import { useState } from 'react';
import { CATEGORIES, addMonths, categoryLabel, dateLabel, formatRWF, periodLabel, periodOf, todayStr, uid } from '../logic';
import { t, tn } from '../i18n';
import { budgetLines, cashFlow, goalProgress, incomeMonth, spentByCategory, suggestedBudgets } from '../money';
import type { Category, Data, Goal, Income, IncomeSource, Period } from '../types';
import type { Update } from '../store';
import { Chip, Field, Modal, MoneyInput, Progress } from './ui';

type Sub = 'income' | 'budget' | 'goals';

export function Money({ data, update, today }: { data: Data; update: Update; today: string }) {
  const [sub, setSub] = useState<Sub>('income');
  const [period, setPeriod] = useState<Period>(periodOf(today));
  const flow = cashFlow(data, period);
  return (
    <div className="stack">
      <div className="month-nav">
        <button className="icon-btn" onClick={() => setPeriod(addMonths(period, -1))} aria-label={t('Previous month')}>‹</button>
        <h2>{periodLabel(period)}</h2>
        <button className="icon-btn" onClick={() => setPeriod(addMonths(period, 1))} aria-label={t('Next month')}>›</button>
      </div>
      <div className="flow card" aria-label={t('Money this month')}>
        <div><span className="muted small">{t('Income')}</span><strong>{formatRWF(flow.income)}</strong></div>
        <span className="op" aria-hidden="true">−</span>
        <div><span className="muted small">{t('Spent')}</span><strong>{formatRWF(flow.spent)}</strong></div>
        <span className="op" aria-hidden="true">−</span>
        <div><span className="muted small">{t('Saved')}</span><strong>{formatRWF(flow.saved)}</strong></div>
        <span className="op" aria-hidden="true">=</span>
        <div className={flow.left < 0 ? 'neg' : 'pos'}><span className="muted small">{t('Left')}</span><strong>{formatRWF(flow.left)}</strong></div>
      </div>
      <div className="segmented" role="tablist">
        {(['income', 'budget', 'goals'] as Sub[]).map((s) => (
          <button key={s} role="tab" aria-selected={sub === s} className={sub === s ? 'on' : ''} onClick={() => setSub(s)}>
            {s === 'income' ? `💰 ${t('Income')}` : s === 'budget' ? `📊 ${t('Budget')}` : `🎯 ${t('Savings goals')}`}
          </button>
        ))}
      </div>
      {sub === 'income' && <IncomeView data={data} update={update} period={period} />}
      {sub === 'budget' && <BudgetView data={data} update={update} period={period} />}
      {sub === 'goals' && <GoalsView data={data} update={update} today={today} />}
    </div>
  );
}

/* ---------------- Income ---------------- */

function IncomeView({ data, update, period }: { data: Data; update: Update; period: Period }) {
  const inc = incomeMonth(data, period);
  const [edit, setEdit] = useState<{ kind: 'source'; item?: IncomeSource } | { kind: 'entry'; item?: Income; sourceId?: string } | null>(null);
  const entries = data.incomes.filter((i) => i.period === period).sort((a, b) => b.date.localeCompare(a.date));
  return (
    <>
      <section className="card">
        <div className="card-head">
          <div>
            <h3>{t('Regular income')}</h3>
            <p className="muted small">{t('Salary, business income, rent you receive… the amount you expect each month.')}</p>
          </div>
          <button className="btn ghost small" onClick={() => setEdit({ kind: 'source' })}>+ {t('Add')}</button>
        </div>
        {inc.sources.length === 0 ? (
          <p className="empty">{t('No regular income yet.')}</p>
        ) : (
          <ul className="list">
            {inc.sources.map((s) => {
              const src = data.incomeSources.find((x) => x.id === s.id)!;
              const done = s.received >= s.expected && s.expected > 0;
              return (
                <li key={s.id}>
                  <span>
                    <button className="link" onClick={() => setEdit({ kind: 'source', item: src })}>{s.name}</button>
                    <span className="muted small block">{t('Expected {amount} around day {day}', { amount: formatRWF(s.expected), day: src.payDay })}</span>
                  </span>
                  <span className="list-right">
                    {done ? <Chip kind="good" icon="✓">{t('Received')}</Chip> : s.received > 0 ? <Chip kind="warn" icon="◐">{formatRWF(s.received)}</Chip> : null}
                    {!done && <button className="btn small primary" onClick={() => setEdit({ kind: 'entry', sourceId: s.id })}>{t('Received')}</button>}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      <section className="card">
        <div className="card-head">
          <h3>{t('Money received in {month}', { month: periodLabel(period) })}</h3>
          <button className="btn ghost small" onClick={() => setEdit({ kind: 'entry' })}>+ {t('Other income')}</button>
        </div>
        {entries.length === 0 ? (
          <p className="empty">{t('Nothing recorded this month.')}</p>
        ) : (
          <ul className="list">
            {entries.map((e) => (
              <li key={e.id}>
                <button className="link" onClick={() => setEdit({ kind: 'entry', item: e })}>{e.label}</button>
                <span className="list-right"><span className="muted small">{dateLabel(e.date)}</span><strong>{formatRWF(e.amount)}</strong></span>
              </li>
            ))}
          </ul>
        )}
      </section>
      {edit?.kind === 'source' && <SourceForm data={data} update={update} item={edit.item} onClose={() => setEdit(null)} />}
      {edit?.kind === 'entry' && <IncomeForm data={data} update={update} item={edit.item} sourceId={edit.sourceId} period={period} onClose={() => setEdit(null)} />}
    </>
  );
}

function SourceForm({ update, item, onClose }: { data: Data; update: Update; item?: IncomeSource; onClose: () => void }) {
  const [name, setName] = useState(item?.name ?? '');
  const [amount, setAmount] = useState<number | ''>(item?.amount ?? '');
  const [payDay, setPayDay] = useState(item?.payDay ?? 25);
  const save = (e: React.FormEvent) => {
    e.preventDefault();
    const s: IncomeSource = { id: item?.id ?? uid(), name: name.trim() || t('Salary'), amount: amount === '' ? 0 : amount, payDay, active: true };
    update((d) => ({ ...d, incomeSources: item ? d.incomeSources.map((x) => (x.id === s.id ? s : x)) : [...d.incomeSources, s] }));
    onClose();
  };
  return (
    <Modal title={item ? t('Edit income') : t('Add regular income')} onClose={onClose}>
      <form className="form" onSubmit={save}>
        <Field label={t('Name')}><input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('e.g. Salary')} /></Field>
        <div className="row-2">
          <Field label={t('Amount per month')}><MoneyInput value={amount} onChange={setAmount} required label={t('Amount per month')} /></Field>
          <Field label={t('Pay day of month')}><input type="number" min={1} max={31} value={payDay} onChange={(e) => setPayDay(Number(e.target.value) || 1)} /></Field>
        </div>
        <div className="form-actions">
          {item && <button type="button" className="btn danger-ghost" onClick={() => { update((d) => ({ ...d, incomeSources: d.incomeSources.filter((x) => x.id !== item.id) })); onClose(); }}>{t('Delete')}</button>}
          <button type="button" className="btn ghost" onClick={onClose}>{t('Cancel')}</button>
          <button className="btn primary">{t('Save')}</button>
        </div>
      </form>
    </Modal>
  );
}

function IncomeForm({ data, update, item, sourceId, period, onClose }: { data: Data; update: Update; item?: Income; sourceId?: string; period: Period; onClose: () => void }) {
  const src = data.incomeSources.find((s) => s.id === (item?.sourceId ?? sourceId));
  const [label, setLabel] = useState(item?.label ?? src?.name ?? '');
  const [amount, setAmount] = useState<number | ''>(item?.amount ?? src?.amount ?? '');
  const [date, setDate] = useState(item?.date ?? (periodOf(todayStr()) === period ? todayStr() : `${period}-01`));
  const [forPeriod, setForPeriod] = useState(item?.period ?? period);
  const [note, setNote] = useState(item?.note ?? '');
  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (amount === '') return;
    const x: Income = { id: item?.id ?? uid(), sourceId: src?.id, label: label.trim() || t('Income'), amount, date, period: forPeriod, note: note.trim() || undefined };
    update((d) => ({ ...d, incomes: item ? d.incomes.map((i) => (i.id === x.id ? x : i)) : [...d.incomes, x] }));
    onClose();
  };
  const opts = Array.from({ length: 7 }, (_, i) => addMonths(period, i - 3));
  return (
    <Modal title={item ? t('Edit income') : t('Record income')} onClose={onClose}>
      <form className="form" onSubmit={save}>
        <Field label={t('What is it?')}><input value={label} onChange={(e) => setLabel(e.target.value)} placeholder={t('e.g. Salary, side job, gift')} /></Field>
        <Field label={t('Amount')}><MoneyInput value={amount} onChange={setAmount} required label={t('Amount')} /></Field>
        <div className="row-2">
          <Field label={t('Date received')}><input type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></Field>
          <Field label={t('Counts for month')} hint={t('e.g. a salary paid on the 28th for next month')}>
            <select value={forPeriod} onChange={(e) => setForPeriod(e.target.value)}>
              {opts.map((p) => <option key={p} value={p}>{periodLabel(p)}</option>)}
            </select>
          </Field>
        </div>
        <Field label={t('Note')}><input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('Optional')} /></Field>
        <div className="form-actions">
          {item && <button type="button" className="btn danger-ghost" onClick={() => { update((d) => ({ ...d, incomes: d.incomes.filter((i) => i.id !== item.id) })); onClose(); }}>{t('Delete')}</button>}
          <button type="button" className="btn ghost" onClick={onClose}>{t('Cancel')}</button>
          <button className="btn primary">{t('Save')}</button>
        </div>
      </form>
    </Modal>
  );
}

/* ---------------- Budget ---------------- */

function BudgetView({ data, update, period }: { data: Data; update: Update; period: Period }) {
  const [editing, setEditing] = useState(false);
  const lines = budgetLines(data, period);
  const spent = spentByCategory(data, period);
  const unbudgeted = CATEGORIES.filter((c) => spent[c.id] > 0 && !data.settings.budgets[c.id]);
  return (
    <>
      <section className="card">
        <div className="card-head">
          <div>
            <h3>{t('Monthly budget')}</h3>
            <p className="muted small">{t('Set how much you plan to spend per category. You get a warning at 90% and when you go over.')}</p>
          </div>
          <button className="btn ghost small" onClick={() => setEditing(true)}>{lines.length ? t('Edit') : t('Set budget')}</button>
        </div>
        {lines.length === 0 ? (
          <p className="empty">{t('No budget yet.')}</p>
        ) : (
          <ul className="budget-list">
            {lines.map((l) => (
              <li key={l.category} className={l.category === 'total' ? 'total' : ''}>
                <div className="budget-row">
                  <span>{l.category === 'total' ? t('Total budget') : categoryLabel(l.category)}</span>
                  <span>
                    {l.state === 'over' && <Chip kind="bad" icon="!">{t('Over by {amount}', { amount: formatRWF(l.spent - l.budget) })}</Chip>}
                    {l.state === 'near' && <Chip kind="warn" icon="⚠">{Math.round(l.pct)}%</Chip>}{' '}
                    <strong>{formatRWF(l.spent)}</strong> <span className="muted small">/ {formatRWF(l.budget)}</span>
                  </span>
                </div>
                <Progress pct={l.pct} state={l.state} color={l.category === 'total' ? 'var(--brand)' : `var(--cat-${l.category})`} />
              </li>
            ))}
          </ul>
        )}
        {unbudgeted.length > 0 && lines.length > 0 && (
          <p className="small muted">{t('Spending without a budget')}: {unbudgeted.map((c) => `${categoryLabel(c.id)} ${formatRWF(spent[c.id])}`).join(' · ')}</p>
        )}
      </section>
      {editing && <BudgetForm data={data} update={update} period={period} onClose={() => setEditing(false)} />}
    </>
  );
}

function BudgetForm({ data, update, period, onClose }: { data: Data; update: Update; period: Period; onClose: () => void }) {
  const [b, setB] = useState<Partial<Record<Category, number>>>({ ...data.settings.budgets });
  const [total, setTotal] = useState<number | ''>(data.settings.totalBudget ?? '');
  const sugg = suggestedBudgets(data, period);
  const sumCats = Object.values(b).reduce((a: number, v) => a + (v ?? 0), 0);
  return (
    <Modal title={t('Monthly budget')} onClose={onClose}>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          const clean = Object.fromEntries(Object.entries(b).filter(([, v]) => v && v > 0));
          update((d) => ({ ...d, settings: { ...d.settings, budgets: clean, totalBudget: total === '' ? undefined : total } }));
          onClose();
        }}
      >
        <button type="button" className="btn ghost small" onClick={() => setB({ ...sugg, ...Object.fromEntries(Object.entries(b).filter(([, v]) => v)) })}>
          ✨ {t('Fill from my bills')}
        </button>
        <div className="budget-grid">
          {CATEGORIES.map((c) => (
            <Field key={c.id} label={`${c.icon} ${t(c.label)}`}>
              <MoneyInput value={b[c.id] ?? ''} onChange={(v) => setB((x) => ({ ...x, [c.id]: v === '' ? undefined : v }))} label={t(c.label)} />
            </Field>
          ))}
        </div>
        <Field label={t('Overall monthly limit')} hint={t('Categories add up to {amount}', { amount: formatRWF(sumCats) })}>
          <MoneyInput value={total} onChange={setTotal} label={t('Overall monthly limit')} />
        </Field>
        <div className="form-actions">
          <button type="button" className="btn ghost" onClick={onClose}>{t('Cancel')}</button>
          <button className="btn primary">{t('Save')}</button>
        </div>
      </form>
    </Modal>
  );
}

/* ---------------- Goals ---------------- */

function GoalsView({ data, update, today }: { data: Data; update: Update; today: string }) {
  const [edit, setEdit] = useState<Goal | 'new' | null>(null);
  const [deposit, setDeposit] = useState<Goal | null>(null);
  const goals = data.goals.filter((g) => !g.archived);
  const archived = data.goals.filter((g) => g.archived);
  return (
    <>
      <div className="page-head">
        <p className="muted small">{t('Put money aside for things that matter – a rent deposit, school fees, a trip.')}</p>
        <button className="btn primary" onClick={() => setEdit('new')}>+ {t('New goal')}</button>
      </div>
      {goals.length === 0 && <p className="empty card">{t('No savings goals yet.')}</p>}
      <div className="cards">
        {goals.map((g) => {
          const p = goalProgress(g, today);
          return (
            <article key={g.id} className="card goal">
              <div className="bill-top">
                <span className="bill-icon" aria-hidden="true">🎯</span>
                <div className="bill-title">
                  <h3>{g.name}</h3>
                  <span className="muted small">{g.deadline ? t('by {month}', { month: periodLabel(g.deadline) }) : t('No deadline')}</span>
                </div>
                {p.done ? <Chip kind="good" icon="✓">{t('Reached')}</Chip> : p.overdue ? <Chip kind="bad" icon="!">{t('Past deadline')}</Chip> : null}
              </div>
              <div className="bill-amounts">
                <div><span className="muted small">{t('Saved')}</span><strong>{formatRWF(p.saved)}</strong></div>
                <div className="right"><span className="muted small">{t('Target')}</span><strong>{formatRWF(g.target)}</strong></div>
              </div>
              <Progress pct={p.pct} color="var(--brand)" />
              <p className="small muted">
                {p.done
                  ? t('Goal reached – well done!')
                  : p.perMonthNeeded != null && p.monthsLeft != null && p.monthsLeft > 0
                    ? t('{remaining} to go · save {amount} a month for {n} months', { remaining: formatRWF(p.remaining), amount: formatRWF(p.perMonthNeeded), n: p.monthsLeft })
                    : t('{remaining} to go', { remaining: formatRWF(p.remaining) })}
              </p>
              <div className="bill-actions">
                <button className="btn small ghost" onClick={() => setEdit(g)}>{t('Edit')}</button>
                {p.done ? (
                  <button className="btn small ghost" onClick={() => update((d) => ({ ...d, goals: d.goals.map((x) => (x.id === g.id ? { ...x, archived: true } : x)) }))}>{t('Archive')}</button>
                ) : (
                  <button className="btn small primary" onClick={() => setDeposit(g)}>+ {t('Add savings')}</button>
                )}
              </div>
              {g.deposits.length > 0 && (
                <details className="pay-list">
                  <summary>{tn(g.deposits.length, '1 deposit', '{n} deposits')}</summary>
                  <ul>
                    {[...g.deposits].sort((a, b) => b.date.localeCompare(a.date)).map((d) => (
                      <li key={d.id}>
                        {dateLabel(d.date)} · {formatRWF(d.amount)}{d.note ? ` · ${d.note}` : ''}{' '}
                        <button className="link small" onClick={() => update((x) => ({ ...x, goals: x.goals.map((gg) => (gg.id === g.id ? { ...gg, deposits: gg.deposits.filter((dd) => dd.id !== d.id) } : gg)) }))}>{t('remove')}</button>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </article>
          );
        })}
      </div>
      {archived.length > 0 && (
        <details className="card">
          <summary>{t('Archived goals')} ({archived.length})</summary>
          <ul className="list">
            {archived.map((g) => (
              <li key={g.id}>
                <span>{g.name} · {formatRWF(goalProgress(g, today).saved)}</span>
                <button className="btn small ghost" onClick={() => update((d) => ({ ...d, goals: d.goals.map((x) => (x.id === g.id ? { ...x, archived: false } : x)) }))}>{t('Restore')}</button>
              </li>
            ))}
          </ul>
        </details>
      )}
      {edit && <GoalForm goal={edit === 'new' ? undefined : edit} update={update} today={today} onClose={() => setEdit(null)} />}
      {deposit && <DepositForm goal={deposit} update={update} onClose={() => setDeposit(null)} />}
    </>
  );
}

function GoalForm({ goal, update, today, onClose }: { goal?: Goal; update: Update; today: string; onClose: () => void }) {
  const [name, setName] = useState(goal?.name ?? '');
  const [target, setTarget] = useState<number | ''>(goal?.target ?? '');
  const [deadline, setDeadline] = useState(goal?.deadline ?? '');
  const opts = Array.from({ length: 60 }, (_, i) => addMonths(periodOf(today), i));
  if (deadline && !opts.includes(deadline)) opts.unshift(deadline);
  return (
    <Modal title={goal ? t('Edit goal') : t('New savings goal')} onClose={onClose}>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          if (target === '') return;
          const g: Goal = { id: goal?.id ?? uid(), name: name.trim() || t('Savings'), target, deadline: deadline || undefined, deposits: goal?.deposits ?? [], archived: goal?.archived };
          update((d) => ({ ...d, goals: goal ? d.goals.map((x) => (x.id === g.id ? g : x)) : [...d.goals, g] }));
          onClose();
        }}
      >
        <Field label={t('Goal')}><input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('e.g. Rent deposit for new house')} required /></Field>
        <div className="row-2">
          <Field label={t('Target amount')}><MoneyInput value={target} onChange={setTarget} required label={t('Target amount')} /></Field>
          <Field label={t('Reach it by')}>
            <select value={deadline} onChange={(e) => setDeadline(e.target.value)}>
              <option value="">{t('No deadline')}</option>
              {opts.map((p) => <option key={p} value={p}>{periodLabel(p)}</option>)}
            </select>
          </Field>
        </div>
        <div className="form-actions">
          {goal && <button type="button" className="btn danger-ghost" onClick={() => { if (confirm(t('Delete this goal and its deposits?'))) { update((d) => ({ ...d, goals: d.goals.filter((x) => x.id !== goal.id) })); onClose(); } }}>{t('Delete')}</button>}
          <button type="button" className="btn ghost" onClick={onClose}>{t('Cancel')}</button>
          <button className="btn primary">{t('Save')}</button>
        </div>
      </form>
    </Modal>
  );
}

function DepositForm({ goal, update, onClose }: { goal: Goal; update: Update; onClose: () => void }) {
  const [amount, setAmount] = useState<number | ''>('');
  const [date, setDate] = useState(todayStr());
  const [note, setNote] = useState('');
  return (
    <Modal title={t('Add savings – {name}', { name: goal.name })} onClose={onClose}>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          if (amount === '' || amount <= 0) return;
          const dep = { id: uid(), date, amount, note: note.trim() || undefined };
          update((d) => ({ ...d, goals: d.goals.map((g) => (g.id === goal.id ? { ...g, deposits: [...g.deposits, dep] } : g)) }));
          onClose();
        }}
      >
        <Field label={t('Amount saved')}><MoneyInput value={amount} onChange={setAmount} required label={t('Amount saved')} /></Field>
        <div className="row-2">
          <Field label={t('Date')}><input type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></Field>
          <Field label={t('Note')}><input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('e.g. moved to savings account')} /></Field>
        </div>
        <div className="form-actions">
          <button type="button" className="btn ghost" onClick={onClose}>{t('Cancel')}</button>
          <button className="btn primary">{t('Save')}</button>
        </div>
      </form>
    </Modal>
  );
}
