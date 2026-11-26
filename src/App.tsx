import { useCallback, useEffect, useRef, useState } from 'react';
import { categoryInfo, dateLabel, formatRWF, methodLabel, periodLabel, periodOf, receiptText, todayStr, billName } from './logic';
import { setLang, t, tk } from './i18n';
import { useData } from './store';
import { emptyData, fingerprint, merge } from './data';
import { clientIdFrom, getDriveState, hasValidToken, signIn, syncNow } from './sync';
import type { Charge, Payment, Period } from './types';
import { Overview } from './components/Overview';
import { Bills } from './components/Bills';
import { Money } from './components/Money';
import { Reports } from './components/Reports';
import { Settings } from './components/Settings';
import { Setup } from './components/Setup';
import { PaymentForm } from './components/PaymentForm';
import { ChargeForm } from './components/ChargeForm';
import { BillForm } from './components/BillForm';
import { ReadingsModal } from './components/Readings';
import { LockScreen } from './components/LockScreen';
import { Modal, PhotoThumb } from './components/ui';

export type Tab = 'home' | 'bills' | 'money' | 'reports' | 'settings';

export type Action =
  | { kind: 'pay'; billId: string; period: Period; suggested?: number; paymentId?: string; paste?: boolean; advance?: boolean }
  | { kind: 'charge'; billId: string; period: Period }
  | { kind: 'bill'; billId?: string }
  | { kind: 'receipt'; paymentId: string }
  | { kind: 'readings'; billId: string }
  | { kind: 'goto'; tab: Tab };

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'home', label: tk('Home'), icon: '🏠' },
  { id: 'bills', label: tk('Bills'), icon: '🧾' },
  { id: 'money', label: tk('Money'), icon: '💰' },
  { id: 'reports', label: tk('Reports'), icon: '📈' },
  { id: 'settings', label: tk('Settings'), icon: '⚙️' },
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
  const [data, update, saved, replace] = useData();
  setLang(data.settings.language);
  const today = useToday();
  const [tab, setTab] = useState<Tab>(() => {
    const h = location.hash.slice(1) as Tab;
    return TABS.some((x) => x.id === h) ? h : 'home';
  });
  const [period, setPeriod] = useState<Period>(periodOf(today));
  const [action, setAction] = useState<Action | null>(null);
  const [toast, setToast] = useState('');
  const [locked, setLocked] = useState(!!data.settings.lock);
  const hiddenAt = useRef<number | null>(null);

  /* ---------- lock when returning from the background ---------- */
  useEffect(() => {
    const onVis = () => {
      if (document.hidden) hiddenAt.current = Date.now();
      else if (hiddenAt.current && data.settings.lock && Date.now() - hiddenAt.current >= data.settings.lockAfterMinutes * 60_000) setLocked(true);
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [data.settings.lock, data.settings.lockAfterMinutes]);

  /* ---------- Google Drive sync ---------- */
  const [syncStatus, setSyncStatus] = useState('');
  const lastSynced = useRef('');
  const dataRef = useRef(data);
  dataRef.current = data;
  const syncing = useRef(false);
  const runSync = useCallback(async (interactive: boolean) => {
    const clientId = clientIdFrom(dataRef.current.settings.googleClientId);
    if (!clientId || syncing.current) return;
    syncing.current = true;
    try {
      if (!hasValidToken()) {
        if (!interactive) return;
        await signIn(clientId);
      }
      setSyncStatus(t('Syncing…'));
      const merged = await syncNow(dataRef.current);
      replace((cur) => merge(cur, merged));
      lastSynced.current = fingerprint(merged);
      setSyncStatus(t('Synced'));
    } catch (e) {
      setSyncStatus(e instanceof Error && e.message === 'needs-sign-in' ? t('Tap to sign in again') : `${t('Sync failed')}: ${e instanceof Error ? e.message : ''}`);
    } finally {
      syncing.current = false;
    }
  }, [replace]);
  useEffect(() => {
    if (!getDriveState().connected || !hasValidToken()) return;
    if (fingerprint(data) === lastSynced.current) return;
    const id = setTimeout(() => runSync(false), 4000);
    return () => clearTimeout(id);
  }, [data, runSync]);

  useEffect(() => {
    const onHash = () => TABS.some((x) => x.id === location.hash.slice(1)) && setTab(location.hash.slice(1) as Tab);
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  const go = (x: Tab) => {
    setTab(x);
    history.replaceState(null, '', `#${x}`);
    window.scrollTo(0, 0);
  };
  const flash = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(''), 2500);
  };
  const close = () => setAction(null);
  const act = (a: Action) => (a.kind === 'goto' ? go(a.tab) : setAction(a));

  if (locked && data.settings.lock) {
    return (
      <LockScreen
        lock={data.settings.lock}
        onUnlock={() => setLocked(false)}
        onForgot={() => {
          if (confirm(t('Reset the app? This erases all data on this device. You can restore it afterwards from a backup file or Google Drive.'))) {
            replace(emptyData());
            setLocked(false);
          }
        }}
      />
    );
  }

  if (!data.setupDone) {
    return (
      <Shell>
        <Setup
          period={periodOf(today)}
          lang={data.settings.language}
          setLang={(l) => update((d) => ({ ...d, settings: { ...d.settings, language: l } }))}
          onDone={(bills, name) => update((d) => ({ ...d, setupDone: true, bills: [...d.bills, ...bills], settings: { ...d.settings, householdName: name } }))}
          onSkip={() => update((d) => ({ ...d, setupDone: true }))}
        />
      </Shell>
    );
  }

  const savePayments = (ps: Payment[], replaceId?: string) => {
    update((d) => ({ ...d, payments: [...d.payments.filter((p) => p.id !== replaceId), ...ps] }));
    close();
    flash(replaceId ? t('Payment updated') : t('Saved {amount}', { amount: formatRWF(ps.reduce((a, p) => a + p.amount, 0)) }));
  };
  const saveCharge = (c: Charge) => {
    update((d) => ({ ...d, charges: [...d.charges.filter((x) => !(x.billId === c.billId && x.period === c.period)), c] }));
    close();
  };

  const activeBills = data.bills.filter((b) => b.active);
  const payableBills = data.bills.filter((b) => b.active || (action?.kind === 'pay' && b.id === action.billId) || (action?.kind === 'pay' && data.payments.find((p) => p.id === action.paymentId)?.billId === b.id));
  const driveOn = !!clientIdFrom(data.settings.googleClientId) && getDriveState().connected;

  return (
    <Shell
      nav={<Nav tab={tab} go={go} />}
      saved={saved}
      cloud={driveOn ? <button className="icon-btn cloud" onClick={() => runSync(true)} title={syncStatus || t('Sync with Google Drive')} aria-label={t('Sync with Google Drive')}>☁️{syncStatus === t('Syncing…') ? '…' : ''}</button> : null}
    >
      {tab === 'home' && <Overview data={data} period={period} today={today} setPeriod={setPeriod} act={act} />}
      {tab === 'bills' && <Bills data={data} update={update} current={periodOf(today)} act={act} />}
      {tab === 'money' && <Money data={data} update={update} today={today} />}
      {tab === 'reports' && <Reports data={data} act={act} today={today} />}
      {tab === 'settings' && <Settings data={data} update={update} replace={replace} sync={{ status: syncStatus, run: () => runSync(true) }} />}

      {(tab === 'home' || tab === 'bills') && activeBills.length > 0 && (
        <button className="fab" onClick={() => setAction({ kind: 'pay', billId: activeBills[0].id, period })} aria-label={t('Record a payment')}>
          + {t('Payment')}
        </button>
      )}

      {action?.kind === 'pay' && (
        <PaymentForm
          bills={payableBills}
          initialBillId={action.billId || activeBills[0]?.id || ''}
          period={action.period}
          suggested={action.suggested}
          existing={data.payments.find((p) => p.id === action.paymentId)}
          pasteMode={action.paste}
          advance={action.advance}
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
      {action?.kind === 'readings' && (() => {
        const bill = data.bills.find((b) => b.id === action.billId);
        return bill ? <ReadingsModal bill={bill} data={data} update={update} onClose={close} /> : null;
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
          <Modal title={t('Payment')} onClose={close}>
            <dl className="receipt">
              <dt>{t('Bill')}</dt><dd>{b ? `${categoryInfo(b.category).icon} ${billName(b)}` : t('(deleted bill)')}</dd>
              <dt>{t('For')}</dt><dd>{periodLabel(p.period)}</dd>
              <dt>{t('Amount')}</dt><dd><strong>{formatRWF(p.amount)}</strong>{p.isAdvance ? ` (${t('advance')})` : ''}</dd>
              <dt>{t('Paid on')}</dt><dd>{dateLabel(p.date)}</dd>
              <dt>{t('Method')}</dt><dd>{methodLabel(p.method)}</dd>
              {p.reference && <><dt>{t('Reference')}</dt><dd>{p.reference}</dd></>}
              {p.kwh != null && <><dt>{t('Units')}</dt><dd>{p.kwh} kWh</dd></>}
              {p.token && <><dt>{t('Token')}</dt><dd><code>{p.token}</code></dd></>}
              {p.note && <><dt>{t('Note')}</dt><dd>{p.note}</dd></>}
            </dl>
            {p.photoIds?.length ? <div className="photos">{p.photoIds.map((id) => <PhotoThumb key={id} id={id} />)}</div> : null}
            <div className="form-actions">
              <button className="btn danger-ghost" onClick={() => { if (confirm(t('Delete this payment?'))) { update((d) => ({ ...d, payments: d.payments.filter((x) => x.id !== p.id) })); close(); flash(t('Payment deleted')); } }}>{t('Delete')}</button>
              <button className="btn ghost" onClick={() => setAction({ kind: 'pay', billId: p.billId, period: p.period, paymentId: p.id })}>{t('Edit')}</button>
              <button
                className="btn primary"
                onClick={async () => {
                  try {
                    if (navigator.share) await navigator.share({ text });
                    else { await navigator.clipboard.writeText(text); flash(t('Receipt copied')); }
                  } catch { /* cancelled */ }
                }}
              >
                {t('Share receipt')}
              </button>
            </div>
          </Modal>
        );
      })()}
      {toast && <div className="toast" role="status">{toast}</div>}
    </Shell>
  );
}

function Shell({ children, nav, saved = true, cloud }: { children: React.ReactNode; nav?: React.ReactNode; saved?: boolean; cloud?: React.ReactNode }) {
  return (
    <div className="app">
      <header className="topbar no-print">
        <div className="brand"><span className="logo" aria-hidden="true">F</span> Fagitire <span className="muted small">{t('Household bills & money')}</span></div>
        <div className="topbar-right">
          {cloud}
          {nav}
        </div>
      </header>
      {!saved && <div className="alert alert-overdue banner">{t('Could not save to this browser’s storage. Download a backup from Settings.')}</div>}
      <main>{children}</main>
    </div>
  );
}

function Nav({ tab, go }: { tab: Tab; go: (t: Tab) => void }) {
  return (
    <nav className="tabs" aria-label={t('Sections')}>
      {TABS.map((x) => (
        <button key={x.id} className={tab === x.id ? 'on' : ''} aria-current={tab === x.id ? 'page' : undefined} onClick={() => go(x.id)}>
          <span aria-hidden="true">{x.icon}</span> <span>{t(x.label)}</span>
        </button>
      ))}
    </nav>
  );
}
