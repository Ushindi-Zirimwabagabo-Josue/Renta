import { useEffect, useRef, useState } from 'react';
import { t } from '../i18n';
import { checkPin, verifyBiometric } from '../lock';
import type { LockSettings } from '../types';

export function LockScreen({ lock, onUnlock, onForgot }: { lock: LockSettings; onUnlock: () => void; onForgot: () => void }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const pinRef = useRef('');
  const busy = useRef(false);

  const tryBio = async () => {
    if (lock.credentialId && (await verifyBiometric(lock.credentialId))) onUnlock();
  };

  const set = (v: string) => {
    pinRef.current = v;
    setPin(v);
  };

  const press = async (d: string) => {
    if (busy.current) return;
    const next = (pinRef.current + d).slice(0, lock.pinLength);
    set(next);
    setError(false);
    if (next.length === lock.pinLength) {
      busy.current = true;
      const ok = await checkPin(lock, next);
      busy.current = false;
      if (ok) onUnlock();
      else {
        setError(true);
        set('');
      }
    }
  };
  const back = () => set(pinRef.current.slice(0, -1));

  useEffect(() => {
    if (lock.credentialId) tryBio();
    const onKey = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === 'Backspace') back();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="lock">
      <div className="lock-box">
        <span className="logo big">F</span>
        <h2>Fagitire</h2>
        <p className="muted">{t('Enter your PIN')}</p>
        <div className={`pin-dots${error ? ' shake' : ''}`} aria-live="polite" aria-label={t('{n} digits entered', { n: pin.length })}>
          {Array.from({ length: lock.pinLength }, (_, i) => <span key={i} className={i < pin.length ? 'on' : ''} />)}
        </div>
        <p className="small err" role="alert">{error ? t('Wrong PIN, try again') : ' '}</p>
        <div className="keypad">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => <button key={d} onClick={() => press(d)}>{d}</button>)}
          {lock.credentialId ? <button onClick={tryBio} aria-label={t('Use fingerprint')}>👆</button> : <span />}
          <button onClick={() => press('0')}>0</button>
          <button onClick={back} aria-label={t('Delete digit')}>⌫</button>
        </div>
        <button className="link small" onClick={onForgot}>{t('Forgot PIN?')}</button>
      </div>
    </div>
  );
}
