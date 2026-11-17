import {
  fieldReceiptsApi,
  OfflineBundleResponse,
  SyncFieldReceiptPayload,
} from '../api/fieldReceipts.api';

const DB_NAME = 'erp_dv_field_receipts_v1';
const DB_VERSION = 1;
const STORE_BUNDLE = 'bundle';
const STORE_QUEUE = 'queue';

export interface QueuedFieldReceipt extends SyncFieldReceiptPayload {
  customerName: string;
  totalAmount: number;
  queuedAt: string;
  lastError?: string | null;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_BUNDLE)) {
        db.createObjectStore(STORE_BUNDLE);
      }
      if (!db.objectStoreNames.contains(STORE_QUEUE)) {
        db.createObjectStore(STORE_QUEUE, { keyPath: 'provisionalCode' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function generateProvisionalCode(collectorUserId: number): string {
  const shortUuid =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID().slice(0, 8).toUpperCase()
      : Math.random().toString(36).slice(2, 10).toUpperCase();
  return `PROV-${collectorUserId}-${Date.now().toString(36).toUpperCase()}-${shortUuid}`;
}

export async function saveOfflineBundle(bundle: OfflineBundleResponse): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_BUNDLE, 'readwrite');
    tx.objectStore(STORE_BUNDLE).put(bundle, 'latest');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadOfflineBundle(): Promise<OfflineBundleResponse | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_BUNDLE, 'readonly');
    const req = tx.objectStore(STORE_BUNDLE).get('latest');
    req.onsuccess = () => resolve((req.result as OfflineBundleResponse) ?? null);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Encola un recibo de forma inmutable en IndexedDB (no expone edición ni borrado local).
 */
export async function enqueueOfflineReceipt(item: QueuedFieldReceipt): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_QUEUE, 'readwrite');
    tx.objectStore(STORE_QUEUE).put(item);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getPendingOfflineReceipts(): Promise<QueuedFieldReceipt[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_QUEUE, 'readonly');
    const req = tx.objectStore(STORE_QUEUE).getAll();
    req.onsuccess = () => {
      const items = (req.result as QueuedFieldReceipt[]) ?? [];
      items.sort((a, b) => a.capturedAt.localeCompare(b.capturedAt));
      resolve(items);
    };
    req.onerror = () => reject(req.error);
  });
}

async function removeSyncedReceipt(provisionalCode: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_QUEUE, 'readwrite');
    tx.objectStore(STORE_QUEUE).delete(provisionalCode);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Sincroniza en orden cronológico todos los recibos en cola apenas hay conectividad.
 */
export async function flushOfflineReceiptQueue(): Promise<{
  syncedCount: number;
  remainingCount: number;
}> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    const pending = await getPendingOfflineReceipts();
    return { syncedCount: 0, remainingCount: pending.length };
  }

  const pending = await getPendingOfflineReceipts();
  let syncedCount = 0;

  for (const item of pending) {
    try {
      const { customerName: _cn, totalAmount: _ta, queuedAt: _qa, lastError: _le, ...payload } = item;
      await fieldReceiptsApi.syncReceipt(payload);
      await removeSyncedReceipt(item.provisionalCode);
      syncedCount += 1;
    } catch (err: any) {
      item.lastError = err?.message || 'Sin conexión con el servidor';
      await enqueueOfflineReceipt(item);
      break;
    }
  }

  const remaining = await getPendingOfflineReceipts();
  return { syncedCount, remainingCount: remaining.length };
}

export function startOfflineSyncListener(
  onFlushComplete: (result: { syncedCount: number; remainingCount: number }) => void,
): () => void {
  const handler = () => {
    void flushOfflineReceiptQueue().then(onFlushComplete);
  };
  window.addEventListener('online', handler);
  return () => window.removeEventListener('online', handler);
}
