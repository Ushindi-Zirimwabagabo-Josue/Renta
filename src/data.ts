import { COLLECTIONS, type Data, type Settings, type Stamped } from './types';

export const STORAGE_KEY = 'fagitire:data:v2';
/** Key used before the app was renamed from "Renta". */
export const LEGACY_KEYS = ['renta:data:v1'];

/**
 * Default REG domestic tariff blocks (RWF/kWh before VAT). Prices change –
 * users can edit them in Settings.
 */
export const DEFAULT_TARIFF: Settings['tariff'] = {
  blocks: [
    { upTo: 20, price: 89 },
    { upTo: 50, price: 310 },
    { upTo: null, price: 369 },
  ],
  vatPct: 18,
};

export function defaultSettings(): Settings {
  return {
    householdName: '',
    reminderDays: 5,
    language: 'en',
    budgets: {},
    tariff: structuredClone(DEFAULT_TARIFF),
    lockAfterMinutes: 5,
  };
}

export function emptyData(): Data {
  return {
    version: 2,
    setupDone: false,
    bills: [],
    charges: [],
    payments: [],
    readings: [],
    incomeSources: [],
    incomes: [],
    goals: [],
    settings: defaultSettings(),
    deleted: {},
  };
}

const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

/** Validates and normalises data from storage or a backup file (v1 or v2). Throws on invalid input. */
export function parseData(raw: unknown): Data {
  if (!raw || typeof raw !== 'object') throw new Error('not-a-backup');
  const r = raw as Record<string, unknown>;
  if ((r.version !== 1 && r.version !== 2) || !Array.isArray(r.bills) || !Array.isArray(r.payments)) {
    throw new Error('not-a-backup');
  }
  const base = emptyData();
  const s = (r.settings ?? {}) as Partial<Settings>;
  return {
    version: 2,
    setupDone: (r.setupDone as boolean | undefined) ?? true,
    bills: arr(r.bills),
    charges: arr(r.charges),
    payments: arr(r.payments),
    readings: arr(r.readings),
    incomeSources: arr(r.incomeSources),
    incomes: arr(r.incomes),
    goals: arr(r.goals),
    settings: {
      ...base.settings,
      ...s,
      budgets: { ...(s.budgets ?? {}) },
      tariff: s.tariff?.blocks?.length ? s.tariff : base.settings.tariff,
    },
    deleted: (r.deleted as Record<string, number>) ?? {},
  };
}

/**
 * Marks what changed between two versions of the data: records that are new or
 * were replaced get a fresh `updatedAt`; records that disappeared get a tombstone.
 * Relies on updates being immutable (changed records are new objects).
 */
export function stamp(prev: Data, next: Data, now = Date.now()): Data {
  if (prev === next) return next;
  const out: Data = { ...next, deleted: { ...next.deleted } };
  for (const c of COLLECTIONS) {
    const before = prev[c] as Stamped[];
    const after = next[c] as Stamped[];
    if (before === after) continue;
    const prevById = new Map(before.map((x) => [x.id, x]));
    const nextIds = new Set<string>();
    (out[c] as Stamped[]) = after.map((x) => {
      nextIds.add(x.id);
      return prevById.get(x.id) === x ? x : { ...x, updatedAt: now };
    });
    for (const x of before) if (!nextIds.has(x.id)) out.deleted[x.id] = now;
  }
  if (prev.settings !== next.settings) out.settings = { ...next.settings, updatedAt: now };
  return out;
}

/**
 * Merges two copies of the data (e.g. this phone and the copy in Google Drive).
 * Per record, the most recently changed version wins; deletions win over older edits.
 */
export function merge(a: Data, b: Data): Data {
  const deleted: Record<string, number> = { ...a.deleted };
  for (const [id, t] of Object.entries(b.deleted)) deleted[id] = Math.max(deleted[id] ?? 0, t);
  const out: Data = {
    ...a,
    setupDone: a.setupDone || b.setupDone,
    // Newest settings win, but the app lock always stays per device.
    settings: { ...((b.settings.updatedAt ?? 0) > (a.settings.updatedAt ?? 0) ? b.settings : a.settings), lock: a.settings.lock },
    deleted,
  };
  for (const c of COLLECTIONS) {
    const byId = new Map<string, Stamped>();
    for (const x of [...(a[c] as Stamped[]), ...(b[c] as Stamped[])]) {
      const cur = byId.get(x.id);
      if (!cur || (x.updatedAt ?? 0) > (cur.updatedAt ?? 0)) byId.set(x.id, x);
    }
    (out[c] as Stamped[]) = [...byId.values()].filter((x) => !(deleted[x.id] && deleted[x.id] >= (x.updatedAt ?? 0)));
  }
  // Forget tombstones older than a year.
  const cutoff = Date.now() - 365 * 86_400_000;
  for (const [id, t] of Object.entries(out.deleted)) if (t < cutoff) delete out.deleted[id];
  return out;
}

/** Changes whenever any record is added, edited or deleted (merges alone don't change it). */
export function fingerprint(d: Data): string {
  const parts: string[] = [String(d.settings.updatedAt ?? 0), String(Object.keys(d.deleted).length)];
  for (const c of COLLECTIONS) for (const x of d[c] as Stamped[]) parts.push(`${x.id}:${x.updatedAt ?? 0}`);
  return parts.sort().join('|');
}
