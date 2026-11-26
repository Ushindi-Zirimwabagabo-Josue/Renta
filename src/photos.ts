/** Receipt / bill photos, stored in IndexedDB (too large for localStorage). */
const DB = 'fagitire-photos';
const STORE = 'photos';

export interface Photo {
  id: string;
  /** JPEG data URL */
  data: string;
  created: number;
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const r = fn(db.transaction(STORE, mode).objectStore(STORE));
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

export const getPhoto = (id: string) => tx<Photo | undefined>('readonly', (s) => s.get(id));
export const putPhoto = (p: Photo) => tx('readwrite', (s) => s.put(p));
export const deletePhoto = (id: string) => tx('readwrite', (s) => s.delete(id));
export const allPhotos = () => tx<Photo[]>('readonly', (s) => s.getAll());

/** Shrinks a camera photo to at most 1280px and ~200 KB so storage and sync stay light. */
export async function compressImage(file: File, max = 1280, quality = 0.72): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = url;
    });
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', quality);
  } finally {
    URL.revokeObjectURL(url);
  }
}
