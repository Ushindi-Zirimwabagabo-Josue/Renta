import { useCallback, useEffect, useState } from 'react';
import type { Data } from './types';
import { LEGACY_KEYS, STORAGE_KEY, emptyData, parseData, stamp } from './data';

export { emptyData, parseData };

export function loadData(): Data {
  for (const key of [STORAGE_KEY, ...LEGACY_KEYS]) {
    try {
      const s = localStorage.getItem(key);
      if (s) return parseData(JSON.parse(s));
    } catch {
      /* storage unavailable or corrupt – try the next key */
    }
  }
  return emptyData();
}

function saveData(d: Data): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(d));
    return true;
  } catch {
    return false;
  }
}

export type Update = (fn: (d: Data) => Data) => void;

export type Replace = (d: Data | ((cur: Data) => Data)) => void;

export function useData(): [Data, Update, boolean, Replace] {
  const [data, setData] = useState<Data>(loadData);
  const [saved, setSaved] = useState(true);
  useEffect(() => {
    setSaved(saveData(data));
  }, [data]);
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
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
  /** Normal edits: change-tracked for sync. */
  const update = useCallback<Update>((fn) => setData((d) => stamp(d, fn(d))), []);
  /** Replace the whole data set without stamping (used after a sync merge). */
  const replace = useCallback<Replace>((d) => setData(d), []);
  return [data, update, saved, replace];
}
