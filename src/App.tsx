import { useEffect, useState } from 'react';
import { categoryInfo, dateLabel, formatRWF, methodLabel, periodLabel, periodOf, receiptText, todayStr } from './logic';
import { useData } from './store';
import type { Charge, Payment, Period } from './types';
import { Overview } from './components/Overview';
import { Bills } from './components/Bills';
import { History } from './components/History';
import { Settings } from './components/Settings';
import { Setup } from './components/Setup';
import { PaymentForm } from './components/PaymentForm';
import { ChargeForm } from './components/ChargeForm';
import { BillForm } from './components/BillForm';
import { Modal } from './components/ui';

export type Action =
  | { kind: 'pay'; billId: string; period: Period; suggested?: number; paymentId?: string }
  | { kind: 'charge'; billId: string; period: Period }
  | { kind: 'bill'; billId?: string }
  | { kind: 'receipt'; paymentId: string };

type Tab = 'overview' | 'bills' | 'history' | 'settings';
const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'overview', label: 'Overview', icon: '📅' },
  { id: 'bills', label: 'Bills', icon: '🧾' },
  { id: 'history', label: 'History', icon: '📜' },
  { id: 'settings', label: 'Settings', icon: '⚙️' },
];

function useToday(): string {
  const [today, setToday] = useState(todayStr());
  useEffect(() => {
    const id = setInterval(() => setToday(todayStr()), 60_000);
    return () => clearInterval(id);
  }, []);
  return today;
}

export default function App() {
  const [data, update, saved] = useData();
  const today = useToday();
  const [tab, setTab] = useState<Tab>(() => (location.hash.slice(1) as Tab) || 'overview');
  const [period, setPeriod] = useState<Period>(periodOf(today));
  const [action, setAction] = useState<Action | null>(null);
  const [toast, setToast] = useState('');

  useEffect(() => {
    const onHash = () => TABS.some((t) => t.id === location.hash.slice(1)) && setTab(location.hash.slice(1) as Tab);
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  const go = (t: Tab) => {
    setTab(t);
    history.replaceState(null, '', `#${t}`);
  };
  const flash = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(''), 2500);
  };
  const close = () => setAction(null);

  if (!data.setupDone) {
    return (
      <Shell>
        <Setup
          period={periodOf(today)}
          onDone={(bills, name) => update((d) => ({ ...d, setupDone: true, bills: [...d.bills, ...bills], settings: { ...d.settings, householdName: name } }))}
          onSkip={() => update((d) => ({ ...d, setupDone: true }))}
        />
      </Shell>
    );
  }

  const savePayments = (ps: Payment[], replaceId?: string) => {
    update((d) => ({ ...d, payments: [...d.payments.filter((p) => p.id !== replaceId), ...ps] }));
    close();
    flash(replaceId ? 'Payment updated' : `Saved ${formatRWF(ps.reduce((a, p) => a + p.amount, 0))}`);
  };
  const saveCharge = (c: Charge) => {
    update((d) => ({ ...d, charges: [...d.charges.filter((x) => !(x.billId === c.billId && x.period === c.period)), c] }));
    close();
  };

  const payableBills = data.bills.filter((b) => b.active || (action?.kind === 'pay' && b.id === action.billId));

  return (
    <Shell nav={<Nav tab={tab} go={go} />} saved={saved}>
      {tab === 'overview' && <Overview data={data} period={period} today={today} setPeriod={setPeriod} act={setAction} />}
      {tab === 'bills' && <Bills data={data} update={update} current={periodOf(today)} act={setAction} />}
      {tab === 'history' && <History data={data} act={setAction} />}
      {tab === 'settings' && <Settings data={data} update={update} />}

      {tab !== 'settings' && data.bills.some((b) => b.active) && (
        <button className="fab" onClick={() => setAction({ kind: 'pay', billId: data.bills.find((b) => b.active)!.id, period })} aria-label="Record a payment">
          + Payment
        </button>
      )}

      {action?.kind === 'pay' && (
        <PaymentForm
          bills={payableBills}
          initialBillId={action.billId}
          period={action.period}
          suggested={action.suggested}
          existing={data.payments.find((p) => p.id === action.paymentId)}
          onSave={savePayments}
          onClose={close}
        />
      )}
      {action?.kind === 'charge' && (() => {
        const bill = data.bills.find((b) => b.id === action.billId);
        const existing = data.charges.find((c) => c.billId === action.billId && c.period === action.period);
        return bill ? (
          <ChargeForm
            bill={bill}
            period={action.period}
            existing={existing}
            onSave={saveCharge}
            onDelete={existing ? () => { update((d) => ({ ...d, charges: d.charges.filter((c) => c.id !== existing.id) })); close(); } : undefined}
            onClose={close}
          />
        ) : null;
      })()}
      {action?.kind === 'bill' && (
        <BillForm
          existing={data.bills.find((b) => b.id === action.billId)}
          currentPeriod={periodOf(today)}
          onSave={(b) => { update((d) => ({ ...d, bills: d.bills.some((x) => x.id === b.id) ? d.bills.map((x) => (x.id === b.id ? b : x)) : [...d.bills, b] })); close(); }}
          onClose={close}
        />
      )}
      {action?.kind === 'receipt' && (() => {
        const p = data.payments.find((x) => x.id === action.paymentId);
        if (!p) return null;
        const b = data.bills.find((x) => x.id === p.billId);
        const text = receiptText(data, p);
        return (
          <Modal title="Payment" onClose={close}>
            <dl className="receipt">
              <dt>Bill</dt><dd>{b ? `${categoryInfo(b.category).icon} ${b.name}` : '(deleted bill)'}</dd>
              <dt>For</dt><dd>{periodLabel(p.period)}</dd>
              <dt>Amount</dt><dd><strong>{formatRWF(p.amount)}</strong></dd>
              <dt>Paid on</dt><dd>{dateLabel(p.date)}</dd>
              <dt>Method</dt><dd>{methodLabel(p.method)}</dd>
              {p.reference && <><dt>Reference</dt><dd>{p.reference}</dd></>}
              {p.kwh != null && <><dt>Units</dt><dd>{p.kwh} kWh</dd></>}
              {p.token && <><dt>Token</dt><dd><code>{p.token}</code></dd></>}
              {p.note && <><dt>Note</dt><dd>{p.note}</dd></>}
            </dl>
            <div className="form-actions">
              <button className="btn danger-ghost" onClick={() => { if (confirm('Delete this payment?')) { update((d) => ({ ...d, payments: d.payments.filter((x) => x.id !== p.id) })); close(); flash('Payment deleted'); } }}>Delete</button>
              <button className="btn ghost" onClick={() => setAction({ kind: 'pay', billId: p.billId, period: p.period, paymentId: p.id })}>Edit</button>
              <button
                className="btn primary"
                onClick={async () => {
                  try {
                    if (navigator.share) await navigator.share({ text });
                    else { await navigator.clipboard.writeText(text); flash('Receipt copied'); }
                  } catch { /* cancelled */ }
                }}
              >
                Share receipt
              </button>
            </div>
          </Modal>
        );
      })()}
      {toast && <div className="toast" role="status">{toast}</div>}
    </Shell>
  );
}

function Shell({ children, nav, saved = true }: { children: React.ReactNode; nav?: React.ReactNode; saved?: boolean }) {
  return (
    <div className="app">
      <header className="topbar">
        <div className="brand"><span className="logo" aria-hidden="true">R</span> Renta <span className="muted small">Kigali household bills</span></div>
        {nav}
      </header>
      {!saved && <div className="alert alert-overdue banner">Could not save to this browser's storage. Download a backup from Settings.</div>}
      <main>{children}</main>
    </div>
  );
}

function Nav({ tab, go }: { tab: Tab; go: (t: Tab) => void }) {
  return (
    <nav className="tabs" aria-label="Sections">
      {TABS.map((t) => (
        <button key={t.id} className={tab === t.id ? 'on' : ''} aria-current={tab === t.id ? 'page' : undefined} onClick={() => go(t.id)}>
          <span aria-hidden="true">{t.icon}</span> <span>{t.label}</span>
        </button>
      ))}
    </nav>
  );
}
