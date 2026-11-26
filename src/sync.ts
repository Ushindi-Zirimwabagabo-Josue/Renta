/**
 * Backup & sync through the user's own Google Drive, in the hidden app-data folder
 * (only Fagitire can see it; it doesn't clutter "My Drive"). No server of our own:
 * the browser talks to Google directly with a short-lived access token.
 */
import { merge, parseData } from './data';
import { allPhotos, getPhoto, putPhoto } from './photos';
import type { Data } from './types';

const SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
const DATA_FILE = 'fagitire-data.json';
const API = 'https://www.googleapis.com/drive/v3';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
const STATE_KEY = 'fagitire:drive';

export interface DriveState {
  connected: boolean;
  lastSync?: number;
}

export function getDriveState(): DriveState {
  try {
    return JSON.parse(localStorage.getItem(STATE_KEY) ?? '') as DriveState;
  } catch {
    return { connected: false };
  }
}
export function setDriveState(s: DriveState) {
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

export function clientIdFrom(settingsId?: string): string | undefined {
  return (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined) || settingsId || undefined;
}

/* ---------- Google Identity Services ---------- */

interface TokenResponse {
  access_token?: string;
  expires_in?: number;
  error?: string;
}
interface TokenClient {
  requestAccessToken: (o?: { prompt?: string }) => void;
}
declare global {
  interface Window {
    google?: { accounts: { oauth2: { initTokenClient: (c: { client_id: string; scope: string; callback: (r: TokenResponse) => void; error_callback?: (e: { type: string }) => void }) => TokenClient; revoke: (token: string, cb?: () => void) => void } } };
  }
}

let gisPromise: Promise<void> | null = null;
function loadGis(): Promise<void> {
  if (window.google?.accounts) return Promise.resolve();
  gisPromise ??= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      gisPromise = null;
      reject(new Error('Could not load Google sign-in. Check your internet connection.'));
    };
    document.head.appendChild(s);
  });
  return gisPromise;
}

let token: { value: string; expires: number } | null = null;

export function hasValidToken(): boolean {
  return !!token && token.expires > Date.now() + 60_000;
}

/** Must be called from a user tap (it may open Google's sign-in popup). */
export async function signIn(clientId: string, prompt: '' | 'consent' = ''): Promise<void> {
  await loadGis();
  await new Promise<void>((resolve, reject) => {
    const client = window.google!.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPE,
      callback: (r) => {
        if (r.error || !r.access_token) return reject(new Error(r.error ?? 'Sign-in failed'));
        token = { value: r.access_token, expires: Date.now() + (r.expires_in ?? 3600) * 1000 };
        resolve();
      },
      error_callback: (e) => reject(new Error(e.type === 'popup_closed' ? 'Sign-in was cancelled' : `Sign-in failed (${e.type})`)),
    });
    client.requestAccessToken({ prompt });
  });
}

export function signOut() {
  if (token && window.google?.accounts) window.google.accounts.oauth2.revoke(token.value);
  token = null;
  setDriveState({ connected: false });
}

async function api(url: string, init: RequestInit = {}): Promise<Response> {
  if (!hasValidToken()) throw new Error('needs-sign-in');
  const res = await fetch(url, { ...init, headers: { ...(init.headers ?? {}), Authorization: `Bearer ${token!.value}` } });
  if (res.status === 401) {
    token = null;
    throw new Error('needs-sign-in');
  }
  if (!res.ok) throw new Error(`Google Drive error ${res.status}`);
  return res;
}

interface DriveFile {
  id: string;
  name: string;
}

async function listFiles(): Promise<DriveFile[]> {
  const out: DriveFile[] = [];
  let pageToken = '';
  do {
    const q = new URLSearchParams({ spaces: 'appDataFolder', fields: 'nextPageToken,files(id,name)', pageSize: '1000' });
    if (pageToken) q.set('pageToken', pageToken);
    const r = (await (await api(`${API}/files?${q}`)).json()) as { files: DriveFile[]; nextPageToken?: string };
    out.push(...r.files);
    pageToken = r.nextPageToken ?? '';
  } while (pageToken);
  return out;
}

async function upload(name: string, body: string, mime: string, existingId?: string): Promise<void> {
  if (existingId) {
    await api(`${UPLOAD}/files/${existingId}?uploadType=media`, { method: 'PATCH', headers: { 'Content-Type': mime }, body });
    return;
  }
  const boundary = `fagitire${Math.random().toString(36).slice(2)}`;
  const meta = JSON.stringify({ name, parents: ['appDataFolder'], mimeType: mime });
  const multipart = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${boundary}\r\nContent-Type: ${mime}\r\n\r\n${body}\r\n--${boundary}--`;
  await api(`${UPLOAD}/files?uploadType=multipart`, { method: 'POST', headers: { 'Content-Type': `multipart/related; boundary=${boundary}` }, body: multipart });
}

/**
 * Two-way sync: downloads the copy in Drive, merges it with this device's data
 * (newest change per record wins), uploads the result, and swaps photos both ways.
 * Returns the merged data for the app to apply.
 */
export async function syncNow(local: Data): Promise<Data> {
  const files = await listFiles();
  const dataFile = files.find((f) => f.name === DATA_FILE);
  let merged = local;
  if (dataFile) {
    const remote = parseData(await (await api(`${API}/files/${dataFile.id}?alt=media`)).json());
    merged = merge(local, remote);
  }
  // The PIN lock is per device – never upload it.
  await upload(DATA_FILE, JSON.stringify({ ...merged, settings: { ...merged.settings, lock: undefined } }), 'application/json', dataFile?.id);

  // Photos: one small file each, named photo-<id>.
  const remotePhotos = new Map(files.filter((f) => f.name.startsWith('photo-')).map((f) => [f.name.slice(6), f.id]));
  const referenced = new Set([...merged.payments, ...merged.charges].flatMap((x) => x.photoIds ?? []));
  const localPhotos = await allPhotos().catch(() => []);
  const localIds = new Set(localPhotos.map((p) => p.id));
  for (const p of localPhotos) {
    if (referenced.has(p.id) && !remotePhotos.has(p.id)) await upload(`photo-${p.id}`, p.data, 'text/plain');
  }
  for (const id of referenced) {
    const fileId = remotePhotos.get(id);
    if (!localIds.has(id) && fileId && !(await getPhoto(id).catch(() => undefined))) {
      const dataUrl = await (await api(`${API}/files/${fileId}?alt=media`)).text();
      await putPhoto({ id, data: dataUrl, created: Date.now() });
    }
  }
  setDriveState({ connected: true, lastSync: Date.now() });
  return merged;
}
