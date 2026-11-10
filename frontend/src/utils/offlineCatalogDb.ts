const DB_NAME = 'dv_preventa_offline_v1';
const DB_VERSION = 1;

export type OfflineStoreName = 'snapshots' | 'offline_orders' | 'offline_visits';

export interface SnapshotRecord<T = unknown> {
  key: string;
  payload: T;
  updatedAt: string;
}

const memoryStores: Record<OfflineStoreName, Map<string, any>> = {
  snapshots: new Map(),
  offline_orders: new Map(),
  offline_visits: new Map(),
};

let dbInstancePromise: Promise<IDBDatabase | null> | null = null;

function hasIndexedDb(): boolean {
  return typeof indexedDB !== 'undefined' && indexedDB !== null;
}

function openOfflineDb(): Promise<IDBDatabase | null> {
  if (!hasIndexedDb()) return Promise.resolve(null);
  if (dbInstancePromise) return dbInstancePromise;

  dbInstancePromise = new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('snapshots')) {
          db.createObjectStore('snapshots', { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains('offline_orders')) {
          db.createObjectStore('offline_orders', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('offline_visits')) {
          db.createObjectStore('offline_visits', { keyPath: 'id' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });

  return dbInstancePromise;
}

export async function idbPutRecord<T extends { [k: string]: any }>(
  storeName: OfflineStoreName,
  record: T,
): Promise<void> {
  const mapKey = String(storeName === 'snapshots' ? record.key : record.id);
  memoryStores[storeName].set(mapKey, record);

  const db = await openOfflineDb();
  if (!db) return;

  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(storeName, 'readwrite');
      tx.objectStore(storeName).put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

export async function idbGetRecord<T>(
  storeName: OfflineStoreName,
  key: string,
): Promise<T | null> {
  const db = await openOfflineDb();
  if (!db) {
    return (memoryStores[storeName].get(key) as T | undefined) ?? null;
  }

  return new Promise<T | null>((resolve) => {
    try {
      const tx = db.transaction(storeName, 'readonly');
      const req = tx.objectStore(storeName).get(key);
      req.onsuccess = () =>
        resolve((req.result as T | undefined) ?? (memoryStores[storeName].get(key) as T | undefined) ?? null);
      req.onerror = () => resolve((memoryStores[storeName].get(key) as T | undefined) ?? null);
    } catch {
      resolve((memoryStores[storeName].get(key) as T | undefined) ?? null);
    }
  });
}

export async function idbGetAllRecords<T>(storeName: OfflineStoreName): Promise<T[]> {
  const db = await openOfflineDb();
  if (!db) {
    return Array.from(memoryStores[storeName].values()) as T[];
  }

  return new Promise<T[]>((resolve) => {
    try {
      const tx = db.transaction(storeName, 'readonly');
      const req = tx.objectStore(storeName).getAll();
      req.onsuccess = () => resolve((req.result as T[]) || []);
      req.onerror = () => resolve(Array.from(memoryStores[storeName].values()) as T[]);
    } catch {
      resolve(Array.from(memoryStores[storeName].values()) as T[]);
    }
  });
}

export async function idbDeleteRecord(storeName: OfflineStoreName, key: string): Promise<void> {
  memoryStores[storeName].delete(key);
  const db = await openOfflineDb();
  if (!db) return;

  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(storeName, 'readwrite');
      tx.objectStore(storeName).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

export async function saveCatalogSnapshot<T>(key: string, payload: T): Promise<string> {
  const updatedAt = new Date().toISOString();
  await idbPutRecord<SnapshotRecord<T>>('snapshots', { key, payload, updatedAt });
  return updatedAt;
}

export async function loadCatalogSnapshot<T>(key: string): Promise<SnapshotRecord<T> | null> {
  return idbGetRecord<SnapshotRecord<T>>('snapshots', key);
}

function normalizeSearchText(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Filtra localmente el catálogo cacheado cuando el vendedor busca sin señal 4G,
 * ignorando mayúsculas, tildes y soportando términos múltiples (ej. "yerba playadito 500").
 */
export function filterCachedProducts<T extends Record<string, any>>(
  products: T[],
  rawQuery?: string,
): T[] {
  const query = normalizeSearchText(rawQuery);
  if (!query) return products;

  const tokens = query.split(/\s+/).filter(Boolean);
  return products.filter((prod) => {
    const haystack = normalizeSearchText(
      `${prod.sku || ''} ${prod.name || ''} ${prod.brand || ''} ${prod.barcode || ''} ${prod.category || ''}`,
    );
    return tokens.every((tok) => haystack.includes(tok));
  });
}

export function __resetOfflineDbMemoryForTests(): void {
  memoryStores.snapshots.clear();
  memoryStores.offline_orders.clear();
  memoryStores.offline_visits.clear();
}
