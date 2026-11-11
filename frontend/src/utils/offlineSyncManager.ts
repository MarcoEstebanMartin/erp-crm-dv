import { idbDeleteRecord, idbPutRecord } from './offlineCatalogDb';
import {
  getOfflineQueueSnapshot,
  isLikelyNetworkError,
  type OfflineOrderItemPayload,
  type QueuedOfflineOrder,
  type QueuedOfflineVisit,
} from './offlineQueueStore';

export * from './offlineQueueStore';

export interface OfflineSyncExecutor {
  sendOrder: (
    payload: { clientId: number; items: OfflineOrderItemPayload[]; notes?: string },
    idempotencyKey: string,
  ) => Promise<unknown>;
  sendVisit: (
    routeId: number,
    payload: {
      personaId: number;
      status: 'ORDERED' | 'NO_BUY';
      noBuyReason?: string | null;
      notes?: string | null;
      latitude?: number | null;
      longitude?: number | null;
    },
    idempotencyKey: string,
  ) => Promise<unknown>;
}

export interface OfflineFlushResult {
  syncedOrders: number;
  syncedVisits: number;
  rejectedOrders: number;
  remainingOrders: number;
  remainingVisits: number;
}

let activeFlushPromise: Promise<OfflineFlushResult> | null = null;

/**
 * Vacía las colas Offline de Pedidos y Visitas en modo single-flight (sin condiciones de carrera),
 * enviando cada operación con su Idempotency-Key persistente original para garantizar 0 duplicados.
 */
export async function flushOfflineQueues(
  executor: OfflineSyncExecutor,
): Promise<OfflineFlushResult> {
  if (activeFlushPromise) return activeFlushPromise;

  activeFlushPromise = (async (): Promise<OfflineFlushResult> => {
    let syncedOrders = 0;
    let syncedVisits = 0;
    let rejectedOrders = 0;
    let networkBroken = false;

    const { orders, visits } = await getOfflineQueueSnapshot();

    for (const order of orders) {
      if (order.status === 'REJECTED') continue;

      try {
        await executor.sendOrder(
          { clientId: order.clientId, items: order.items, notes: order.notes },
          order.idempotencyKey,
        );
        await idbDeleteRecord('offline_orders', order.id);
        syncedOrders++;

        if (order.routeId) {
          try {
            await executor.sendVisit(
              order.routeId,
              {
                personaId: order.clientId,
                status: 'ORDERED',
                latitude: order.latitude,
                longitude: order.longitude,
              },
              `${order.idempotencyKey}-visit`,
            );
          } catch {
            // El pedido ya quedó confirmado; el check-in GPS es secundario
          }
        }
      } catch (err: any) {
        const message = err?.message || 'Error al sincronizar pedido';
        if (isLikelyNetworkError(err)) {
          networkBroken = true;
          await idbPutRecord<QueuedOfflineOrder>('offline_orders', {
            ...order,
            attempts: order.attempts + 1,
            lastError: 'Sin señal estable (reintentará automáticamente)',
          });
          break;
        } else {
          rejectedOrders++;
          await idbPutRecord<QueuedOfflineOrder>('offline_orders', {
            ...order,
            attempts: order.attempts + 1,
            status: 'REJECTED',
            lastError: message,
          });
        }
      }
    }

    if (!networkBroken) {
      for (const visit of visits) {
        if (visit.syncState === 'REJECTED') continue;
        try {
          await executor.sendVisit(
            visit.routeId,
            {
              personaId: visit.personaId,
              status: visit.status,
              noBuyReason: visit.noBuyReason,
              notes: visit.notes,
              latitude: visit.latitude,
              longitude: visit.longitude,
            },
            visit.idempotencyKey,
          );
          await idbDeleteRecord('offline_visits', visit.id);
          syncedVisits++;
        } catch (err: any) {
          const visitErrorMsg = err?.message || 'Error de validación en visita';
          if (isLikelyNetworkError(err)) {
            await idbPutRecord<QueuedOfflineVisit>('offline_visits', {
              ...visit,
              attempts: visit.attempts + 1,
              lastError: 'Pendiente de señal',
            });
            break;
          } else if (visit.attempts + 1 >= 3) {
            // Conserva registro con estado REJECTED para revisión manual sin borrar trazabilidad
            await idbPutRecord<QueuedOfflineVisit>('offline_visits', {
              ...visit,
              attempts: visit.attempts + 1,
              syncState: 'REJECTED',
              lastError: visitErrorMsg,
            });
          } else {
            await idbPutRecord<QueuedOfflineVisit>('offline_visits', {
              ...visit,
              attempts: visit.attempts + 1,
              lastError: visitErrorMsg,
            });
          }
        }
      }
    }

    const remaining = await getOfflineQueueSnapshot();
    return {
      syncedOrders,
      syncedVisits,
      rejectedOrders,
      remainingOrders: remaining.orders.length,
      remainingVisits: remaining.visits.length,
    };
  })();

  try {
    return await activeFlushPromise;
  } finally {
    activeFlushPromise = null;
  }
}
