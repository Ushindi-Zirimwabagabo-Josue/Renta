import { useCallback, useEffect, useState } from 'react';
import type { Data } from './types';

const KEY = 'renta:data:v1';

export function emptyData(): Data {
  return {
    version: 1,
    setupDone: false,
    bills: [],
    charges: [],
    payments: [],
    settings: { householdName: '', reminderDays: 5 },
  };
}

/** Validates and normalises data from storage or a backup file. Throws on invalid input. */
export function parseData(raw: unknown): Data {
  if (!raw || typeof raw !== 'object') throw new Error('Not a Renta backup file');
  const r = raw as Partial<Data>;
  if (r.version !== 1 || !Array.isArray(r.bills) || !Array.isArray(r.payments)) {
    throw new Error('Not a Renta backup file');
  }
  const base = emptyData();
  return {
    version: 1,
    setupDone: r.setupDone ?? true,
    bills: r.bills,
    charges: Array.isArray(r.charges) ? r.charges : [],
    payments: r.payments,
    settings: { ...base.settings, ...(r.settings ?? {}) },
  };
}

export function loadData(): Data {
  try {
    const s = localStorage.getItem(KEY);
    if (s) return parseData(JSON.parse(s));
  } catch {
    /* storage unavailable or corrupt – start fresh */
  }
  return emptyData();
}

function saveData(d: Data): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(d));
    return true;
  } catch {
    return false;
  }
}

export type Update = (fn: (d: Data) => Data) => void;

export function useData(): [Data, Update, boolean] {
  const [data, setData] = useState<Data>(loadData);
  const [saved, setSaved] = useState(true);
  useEffect(() => {
    setSaved(saveData(data));
  }, [data]);
  // Keep several open tabs in sync.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY && e.newValue) {
        try {
          setData(parseData(JSON.parse(e.newValue)));
        } catch {
          /* ignore */
        }
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);
  const update = useCallback<Update>((fn) => setData((d) => fn(d)), []);
  return [data, update, saved];
}
