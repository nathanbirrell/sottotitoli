import type { DictEntry } from './dictionary';

const DB_NAME = 'sottotitoli';
const ENTRIES = 'entries';
const META = 'meta';

export interface DictMeta {
  version: number;
  count: number;
  complete: boolean;
}

let dbPromise: Promise<IDBDatabase> | undefined;

function openDb(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(ENTRIES);
      req.result.createObjectStore(META);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = tx.onabort = () => reject(tx.error);
  });
}

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getMeta(): Promise<DictMeta | undefined> {
  const db = await openDb();
  return request(db.transaction(META).objectStore(META).get('dict'));
}

export async function setMeta(meta: DictMeta): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(META, 'readwrite');
  tx.objectStore(META).put(meta, 'dict');
  await done(tx);
}

export async function clearEntries(): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(ENTRIES, 'readwrite');
  tx.objectStore(ENTRIES).clear();
  await done(tx);
}

export async function putEntries(pairs: [string, DictEntry][]): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(ENTRIES, 'readwrite');
  const store = tx.objectStore(ENTRIES);
  for (const [key, entry] of pairs) store.put(entry, key);
  await done(tx);
}

export async function getEntries(keys: string[]): Promise<(DictEntry | undefined)[]> {
  const db = await openDb();
  const store = db.transaction(ENTRIES).objectStore(ENTRIES);
  return Promise.all(keys.map((k) => request<DictEntry | undefined>(store.get(k))));
}
