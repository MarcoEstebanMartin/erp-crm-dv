import { generateSafeIdempotencyKey } from './idempotencyClient';
import {
  idbDeleteRecord,
  idbGetAllRecords,
  idbPutRecord,
} from './offlineCatalogDb';

export interface OfflineOrderItemPayload {
  productId: number;
  quantity: number;
  isEmergencyOverride?: boolean;
}

export interface QueuedOfflineOrder {
  id: string;
  idempotencyKey: string;
  clientId: number;
  clientName: string;
  items: OfflineOrderItemPayload[];
  notes: string;
  routeId: number | null;
  latitude: number | null;
  longitude: number | null;
  createdAt: string;
  attempts: number;
  status: 'PENDING' | 'REJECTED';
  lastError?: string | null;
}

export interface QueuedOfflineVisit {
  id: string;
  idempotencyKey: string;
  routeId: number;
  personaId: number;
  clientName?: string;
  status: 'ORDERED' | 'NO_BUY';
  noBuyReason?: string | null;
  notes?: string | null;
  latitude: number | null;
  longitude: number | null;
  createdAt: string;
  attempts: number;
  lastError?: string | null;
}

/**
 * Distingue caídas reales de red / microcortes 4G ("4G fantasma") de errores de negocio (400/422).
 */
export function isLikelyNetworkError(err: unknown): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  if (!err) return false;
  if (err instanceof TypeError) return true;

  const status = (err as any)?.status;
  if (status === 0 || status === 408 || status === 502 || status === 503 || status === 504) {
    return true;
  }

  const msg = String((err as any)?.message || err).toLowerCase();
  return (
    msg.includes('failed to fetch') ||
    msg.includes('networkerror') ||
    msg.includes('load failed') ||
    msg.includes('network request failed') ||
    msg.includes('aborted') ||
    msg.includes('timeout') ||
    msg.includes('sin conexión')
  );
}

export async function enqueueOfflineOrder(input: {
  clientId: number;
  clientName: string;
  items: OfflineOrderItemPayload[];
  notes: string;
  routeId: number | null;
  latitude: number | null;
  longitude: number | null;
  idempotencyKey?: string;
}): Promise<QueuedOfflineOrder> {
  const idempotencyKey = input.idempotencyKey || generateSafeIdempotencyKey();
  const record: QueuedOfflineOrder = {
    id: `ord-${Date.now()}-${idempotencyKey.slice(0, 8)}`,
    idempotencyKey,
    clientId: input.clientId,
    clientName: input.clientName,
    items: input.items,
    notes: input.notes,
    routeId: input.routeId,
    latitude: input.latitude,
    longitude: input.longitude,
    createdAt: new Date().toISOString(),
    attempts: 0,
    status: 'PENDING',
    lastError: null,
  };
  await idbPutRecord('offline_orders', record);
  return record;
}

export async function enqueueOfflineVisit(input: {
  routeId: number;
  personaId: number;
  clientName?: string;
  status: 'ORDERED' | 'NO_BUY';
  noBuyReason?: string | null;
  notes?: string | null;
  latitude: number | null;
  longitude: number | null;
  idempotencyKey?: string;
}): Promise<QueuedOfflineVisit> {
  const idempotencyKey = input.idempotencyKey || generateSafeIdempotencyKey();
  const record: QueuedOfflineVisit = {
    id: `vis-${Date.now()}-${idempotencyKey.slice(0, 8)}`,
    idempotencyKey,
    routeId: input.routeId,
    personaId: input.personaId,
    clientName: input.clientName,
    status: input.status,
    noBuyReason: input.noBuyReason ?? null,
    notes: input.notes ?? null,
    latitude: input.latitude,
    longitude: input.longitude,
    createdAt: new Date().toISOString(),
    attempts: 0,
    lastError: null,
  };
  await idbPutRecord('offline_visits', record);
  return record;
}

export async function migrateLegacyLocalStorageQueues(): Promise<void> {
  if (typeof localStorage === 'undefined') return;
  try {
    const rawOrders = localStorage.getItem('offline_orders');
    if (rawOrders) {
      const parsed = JSON.parse(rawOrders);
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (item && item.clientId && Array.isArray(item.items)) {
            await enqueueOfflineOrder({
              clientId: Number(item.clientId),
              clientName: String(item.clientName || `Cliente #${item.clientId}`),
              items: item.items,
              notes: String(item.notes || ''),
              routeId: item.routeId ? Number(item.routeId) : null,
              latitude: item.latitude ?? null,
              longitude: item.longitude ?? null,
            });
          }
        }
      }
      localStorage.removeItem('offline_orders');
    }

    const rawVisits = localStorage.getItem('offline_route_visits');
    if (rawVisits) {
      const parsedV = JSON.parse(rawVisits);
      if (Array.isArray(parsedV)) {
        for (const v of parsedV) {
          if (v && v.routeId && v.personaId) {
            await enqueueOfflineVisit({
              routeId: Number(v.routeId),
              personaId: Number(v.personaId),
              status: v.status === 'ORDERED' ? 'ORDERED' : 'NO_BUY',
              noBuyReason: v.noBuyReason ?? null,
              notes: v.notes ?? null,
              latitude: v.latitude ?? null,
              longitude: v.longitude ?? null,
            });
          }
        }
      }
      localStorage.removeItem('offline_route_visits');
    }
  } catch {
    // Ignorar formato legado corrupto
  }
}

export async function getOfflineQueueSnapshot(): Promise<{
  orders: QueuedOfflineOrder[];
  visits: QueuedOfflineVisit[];
}> {
  const [orders, visits] = await Promise.all([
    idbGetAllRecords<QueuedOfflineOrder>('offline_orders'),
    idbGetAllRecords<QueuedOfflineVisit>('offline_visits'),
  ]);
  orders.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  visits.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return { orders, visits };
}

export async function discardOfflineOrder(id: string): Promise<void> {
  await idbDeleteRecord('offline_orders', id);
}

export async function retryRejectedOfflineOrder(id: string): Promise<void> {
  const { orders } = await getOfflineQueueSnapshot();
  const found = orders.find((o) => o.id === id);
  if (!found) return;
  await idbPutRecord('offline_orders', { ...found, status: 'PENDING' as const, lastError: null });
}
