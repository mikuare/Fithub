/**
 * Tiny IndexedDB wrapper used by the local data adapter.
 *
 * Everything lives in one object store keyed by `${collection}:${id}` with
 * indexes on collection and on [collection, user_id], which is enough to serve
 * every read pattern the app has without a per-collection schema.
 *
 * If IndexedDB is unavailable (private windows, locked-down browsers) we fall
 * back to an in-memory map mirrored into localStorage, so the app still runs —
 * it just will not survive a hard refresh in that environment.
 */

const DB_NAME = 'fithub';
const DB_VERSION = 1;
const STORE = 'records';

export interface StoredRecord {
  pk: string;
  collection: string;
  id: string;
  user_id: string | null;
  data: unknown;
  updated_at: number;
}

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDB(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') return resolve(null);
    let req: IDBOpenDBRequest;
    try {
      req = indexedDB.open(DB_NAME, DB_VERSION);
    } catch {
      return resolve(null);
    }
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'pk' });
        store.createIndex('collection', 'collection', { unique: false });
        store.createIndex('collection_user', ['collection', 'user_id'], { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
    req.onblocked = () => resolve(null);
  });
  return dbPromise;
}

/* ---------------- memory / localStorage fallback ---------------- */

const FALLBACK_KEY = 'fithub:fallback';
let memory: Map<string, StoredRecord> | null = null;

function fallback(): Map<string, StoredRecord> {
  if (memory) return memory;
  memory = new Map();
  try {
    const raw = localStorage.getItem(FALLBACK_KEY);
    if (raw) for (const rec of JSON.parse(raw) as StoredRecord[]) memory.set(rec.pk, rec);
  } catch { /* corrupt or unavailable storage — start clean */ }
  return memory;
}

function persistFallback() {
  // This path is used only when IndexedDB is unavailable. Persist before the
  // write resolves so an immediate refresh cannot lose a newly generated
  // programme or a just-activated sandbox subscription.
  try {
    localStorage.setItem(FALLBACK_KEY, JSON.stringify([...fallback().values()]));
  } catch { /* quota exceeded — data stays in memory for this session */ }
}

/* ---------------- public API ---------------- */

const pkOf = (collection: string, id: string) => `${collection}:${id}`;

function tx(db: IDBDatabase, mode: IDBTransactionMode) {
  return db.transaction(STORE, mode).objectStore(STORE);
}

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function idbPut(collection: string, id: string, userId: string | null, data: unknown): Promise<void> {
  const rec: StoredRecord = { pk: pkOf(collection, id), collection, id, user_id: userId, data, updated_at: Date.now() };
  const db = await openDB();
  if (!db) { fallback().set(rec.pk, rec); persistFallback(); return; }
  await request(tx(db, 'readwrite').put(rec));
}

export async function idbPutMany(rows: Array<{ collection: string; id: string; userId: string | null; data: unknown }>): Promise<void> {
  if (!rows.length) return;
  const db = await openDB();
  if (!db) {
    for (const r of rows) {
      fallback().set(pkOf(r.collection, r.id), {
        pk: pkOf(r.collection, r.id), collection: r.collection, id: r.id,
        user_id: r.userId, data: r.data, updated_at: Date.now(),
      });
    }
    persistFallback();
    return;
  }
  await new Promise<void>((resolve, reject) => {
    const t = db.transaction(STORE, 'readwrite');
    const store = t.objectStore(STORE);
    for (const r of rows) {
      store.put({ pk: pkOf(r.collection, r.id), collection: r.collection, id: r.id, user_id: r.userId, data: r.data, updated_at: Date.now() });
    }
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

export async function idbGet<T>(collection: string, id: string): Promise<T | null> {
  const db = await openDB();
  if (!db) return (fallback().get(pkOf(collection, id))?.data as T) ?? null;
  const rec = await request<StoredRecord | undefined>(tx(db, 'readonly').get(pkOf(collection, id)));
  return (rec?.data as T) ?? null;
}

export async function idbAll<T>(collection: string): Promise<T[]> {
  const db = await openDB();
  if (!db) return [...fallback().values()].filter((r) => r.collection === collection).map((r) => r.data as T);
  const idx = tx(db, 'readonly').index('collection');
  const rows = await request<StoredRecord[]>(idx.getAll(IDBKeyRange.only(collection)));
  return rows.map((r) => r.data as T);
}

export async function idbByUser<T>(collection: string, userId: string): Promise<T[]> {
  const db = await openDB();
  if (!db) {
    return [...fallback().values()]
      .filter((r) => r.collection === collection && r.user_id === userId)
      .map((r) => r.data as T);
  }
  const idx = tx(db, 'readonly').index('collection_user');
  const rows = await request<StoredRecord[]>(idx.getAll(IDBKeyRange.only([collection, userId])));
  return rows.map((r) => r.data as T);
}

export async function idbDelete(collection: string, id: string): Promise<void> {
  const db = await openDB();
  if (!db) { fallback().delete(pkOf(collection, id)); persistFallback(); return; }
  await request(tx(db, 'readwrite').delete(pkOf(collection, id)));
}

/** Removes every record belonging to a user across all collections. */
export async function idbDeleteUser(userId: string): Promise<void> {
  const db = await openDB();
  if (!db) {
    for (const [pk, rec] of fallback()) if (rec.user_id === userId) fallback().delete(pk);
    persistFallback();
    return;
  }
  await new Promise<void>((resolve, reject) => {
    const t = db.transaction(STORE, 'readwrite');
    const store = t.objectStore(STORE);
    const cursorReq = store.openCursor();
    cursorReq.onsuccess = () => {
      const cursor = cursorReq.result;
      if (!cursor) return;
      const rec = cursor.value as StoredRecord;
      if (rec.user_id === userId) cursor.delete();
      cursor.continue();
    };
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
}

export async function idbWipe(): Promise<void> {
  const db = await openDB();
  if (!db) { fallback().clear(); persistFallback(); return; }
  await request(tx(db, 'readwrite').clear());
}

/** True when durable storage is actually available in this browser. */
export async function idbAvailable(): Promise<boolean> {
  return (await openDB()) !== null;
}
