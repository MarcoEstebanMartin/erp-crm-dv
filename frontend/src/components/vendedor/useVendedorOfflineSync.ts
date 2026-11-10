import { useState, useEffect, useCallback } from 'react';
import { api } from '../../utils/api';
import { loadCatalogSnapshot } from '../../utils/offlineCatalogDb';
import {
  discardOfflineOrder,
  enqueueOfflineOrder,
  enqueueOfflineVisit,
  flushOfflineQueues,
  getOfflineQueueSnapshot,
  migrateLegacyLocalStorageQueues,
  retryRejectedOfflineOrder,
  type OfflineOrderItemPayload,
  type QueuedOfflineOrder,
  type QueuedOfflineVisit,
} from '../../utils/offlineSyncManager';

interface UseVendedorOfflineSyncOptions {
  onSynced?: () => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export function useVendedorOfflineSync({ onSynced, showToast }: UseVendedorOfflineSyncOptions) {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );
  const [usingCachedCatalog, setUsingCachedCatalog] = useState<boolean>(false);
  const [lastCatalogSyncAt, setLastCatalogSyncAt] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [queuedOrders, setQueuedOrders] = useState<QueuedOfflineOrder[]>([]);
  const [queuedVisits, setQueuedVisits] = useState<QueuedOfflineVisit[]>([]);

  const refreshQueueState = useCallback(async () => {
    const [queueSnap, prodSnap] = await Promise.all([
      getOfflineQueueSnapshot(),
      loadCatalogSnapshot('products_full'),
    ]);
    setQueuedOrders(queueSnap.orders);
    setQueuedVisits(queueSnap.visits);
    if (prodSnap?.updatedAt) {
      setLastCatalogSyncAt(prodSnap.updatedAt);
    }
  }, []);

  const syncNow = useCallback(async () => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      await refreshQueueState();
      return;
    }

    const current = await getOfflineQueueSnapshot();
    const actionableOrders = current.orders.filter((o) => o.status === 'PENDING');
    if (actionableOrders.length === 0 && current.visits.length === 0) {
      setQueuedOrders(current.orders);
      setQueuedVisits(current.visits);
      return;
    }

    setIsSyncing(true);
    try {
      const res = await flushOfflineQueues({
        sendOrder: (payload, idempotencyKey) =>
          api.createOrder(payload, { idempotencyKey }),
        sendVisit: (routeId, payload, idempotencyKey) =>
          api.recordRouteVisit(routeId, payload, { idempotencyKey }),
      });

      await refreshQueueState();

      if (res.syncedOrders > 0 || res.syncedVisits > 0) {
        const parts: string[] = [];
        if (res.syncedOrders > 0) parts.push(`${res.syncedOrders} pedido(s)`);
        if (res.syncedVisits > 0) parts.push(`${res.syncedVisits} visita(s)`);
        showToast(`Sincronización completada: ${parts.join(' y ')} enviados.`, 'success');
        onSynced?.();
      }
      if (res.rejectedOrders > 0) {
        showToast(
          `${res.rejectedOrders} pedido(s) requieren revisión en la cola offline.`,
          'error',
        );
      }
    } finally {
      setIsSyncing(false);
    }
  }, [onSynced, refreshQueueState, showToast]);

  const queueOrderOffline = useCallback(
    async (input: {
      clientId: number;
      clientName: string;
      items: OfflineOrderItemPayload[];
      notes: string;
      routeId: number | null;
      latitude: number | null;
      longitude: number | null;
      idempotencyKey?: string;
    }) => {
      const rec = await enqueueOfflineOrder(input);
      await refreshQueueState();
      return rec;
    },
    [refreshQueueState],
  );

  const queueVisitOffline = useCallback(
    async (input: {
      routeId: number;
      personaId: number;
      clientName?: string;
      status: 'ORDERED' | 'NO_BUY';
      noBuyReason?: string | null;
      notes?: string | null;
      latitude: number | null;
      longitude: number | null;
      idempotencyKey?: string;
    }) => {
      const rec = await enqueueOfflineVisit(input);
      await refreshQueueState();
      return rec;
    },
    [refreshQueueState],
  );

  const removeQueuedOrder = useCallback(
    async (id: string) => {
      await discardOfflineOrder(id);
      await refreshQueueState();
    },
    [refreshQueueState],
  );

  const retryQueuedOrder = useCallback(
    async (id: string) => {
      await retryRejectedOfflineOrder(id);
      await syncNow();
    },
    [syncNow],
  );

  useEffect(() => {
    migrateLegacyLocalStorageQueues()
      .then(() => refreshQueueState())
      .then(() => syncNow());

    const handleOnline = () => {
      setIsOnline(true);
      syncNow();
    };
    const handleOffline = () => {
      setIsOnline(false);
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        syncNow();
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [refreshQueueState, syncNow]);

  return {
    isOnline,
    isSyncing,
    usingCachedCatalog,
    setUsingCachedCatalog,
    lastCatalogSyncAt,
    setLastCatalogSyncAt,
    queuedOrders,
    queuedVisits,
    syncNow,
    queueOrderOffline,
    queueVisitOffline,
    removeQueuedOrder,
    retryQueuedOrder,
  };
}
