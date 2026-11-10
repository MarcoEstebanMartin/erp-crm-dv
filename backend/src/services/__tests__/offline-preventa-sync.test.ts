import path from 'path';
import { pathToFileURL } from 'url';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

let catalogDb: any;
let syncManager: any;

describe('Preventa en Ruta Offline PWA — Catálogo Local y Cola Idempotente', () => {
  beforeAll(async () => {
    const utilsDir = path.resolve(__dirname, '../../../../frontend/src/utils');
    catalogDb = await import(pathToFileURL(path.join(utilsDir, 'offlineCatalogDb.ts')).href);
    syncManager = await import(pathToFileURL(path.join(utilsDir, 'offlineSyncManager.ts')).href);
  });

  beforeEach(() => {
    catalogDb.__resetOfflineDbMemoryForTests();
  });

  it('guarda snapshots de catálogo y filtra localmente ignorando tildes y mayúsculas', async () => {
    const sampleProducts = [
      { id: 1, sku: '0015', name: 'Azúcar Común Ledesma 1kg', brand: 'Ledesma', listPrice: 1200 },
      { id: 2, sku: '0104', name: 'Yerba Mate Playadito Suave 500g', brand: 'Playadito', listPrice: 2450 },
      { id: 3, sku: '0220', name: 'Aceite Girasol Natura 900ml', brand: 'Natura', listPrice: 1980 },
    ];

    const updatedAt = await catalogDb.saveCatalogSnapshot('products_full', sampleProducts);
    expect(updatedAt).toBeTruthy();

    const restored = await catalogDb.loadCatalogSnapshot('products_full');
    expect(restored?.payload).toHaveLength(3);

    const byAccentlessTokens = catalogDb.filterCachedProducts(restored!.payload, 'azucar 1kg');
    expect(byAccentlessTokens).toHaveLength(1);
    expect(byAccentlessTokens[0].sku).toBe('0015');

    const bySku = catalogDb.filterCachedProducts(restored!.payload, '0104');
    expect(bySku).toHaveLength(1);
    expect(bySku[0].brand).toBe('Playadito');
  });

  it('preserva exactamente la misma Idempotency-Key tras un microcorte de red 4G', async () => {
    const queued = await syncManager.enqueueOfflineOrder({
      clientId: 42,
      clientName: 'Autoservicio El Sol',
      items: [{ productId: 10, quantity: 3 }],
      notes: 'Entregar por portón lateral',
      routeId: 5,
      latitude: -34.6037,
      longitude: -58.3816,
    });
    await syncManager.enqueueOfflineVisit({
      routeId: 5,
      personaId: 99,
      clientName: 'Despensa Norte',
      status: 'NO_BUY',
      noBuyReason: 'Estaba cerrado',
      notes: null,
      latitude: -34.61,
      longitude: -58.39,
    });

    const receivedOrderKeys: string[] = [];
    let failFirstNetworkCall = true;

    const executor = {
      sendOrder: vi.fn(async (_payload: unknown, idemKey: string) => {
        receivedOrderKeys.push(idemKey);
        if (failFirstNetworkCall) {
          failFirstNetworkCall = false;
          throw new TypeError('Failed to fetch');
        }
        return { id: 9001 };
      }),
      sendVisit: vi.fn(async () => ({ ok: true })),
    };

    expect(syncManager.isLikelyNetworkError(new TypeError('Failed to fetch'))).toBe(true);

    // Intento 1: se corta el 4G; el pedido queda PENDING con attempts=1
    const firstAttempt = await syncManager.flushOfflineQueues(executor);
    expect(firstAttempt.syncedOrders).toBe(0);
    expect(firstAttempt.remainingOrders).toBe(1);

    const midSnap = await syncManager.getOfflineQueueSnapshot();
    expect(midSnap.orders[0].status).toBe('PENDING');
    expect(midSnap.orders[0].attempts).toBe(1);

    // Intento 2: vuelve la señal; envía con la MISMA Idempotency-Key original y vacía la cola
    const secondAttempt = await syncManager.flushOfflineQueues(executor);
    expect(secondAttempt.syncedOrders).toBe(1);
    expect(secondAttempt.syncedVisits).toBe(1);
    expect(secondAttempt.remainingOrders).toBe(0);
    expect(secondAttempt.remainingVisits).toBe(0);

    expect(receivedOrderKeys).toEqual([queued.idempotencyKey, queued.idempotencyKey]);
  });

  it('garantiza ejecución single-flight sin duplicar envíos si online y botón manual disparan a la vez', async () => {
    await syncManager.enqueueOfflineOrder({
      clientId: 77,
      clientName: 'Almacén San Martín',
      items: [{ productId: 1, quantity: 2 }],
      notes: '',
      routeId: null,
      latitude: null,
      longitude: null,
    });

    const sendOrder = vi.fn(async () => {
      await new Promise((r) => setTimeout(r, 25));
      return { id: 9002 };
    });
    const sendVisit = vi.fn(async () => ({ ok: true }));

    const [resA, resB] = await Promise.all([
      syncManager.flushOfflineQueues({ sendOrder, sendVisit }),
      syncManager.flushOfflineQueues({ sendOrder, sendVisit }),
    ]);

    expect(sendOrder).toHaveBeenCalledTimes(1);
    expect(resA.syncedOrders).toBe(1);
    expect(resB.syncedOrders).toBe(1);
  });

  it('aísla un pedido rechazado por regla de negocio (400) sin bloquear los pedidos siguientes', async () => {
    const badOrder = await syncManager.enqueueOfflineOrder({
      clientId: 11,
      clientName: 'Cliente Inactivo',
      items: [{ productId: 999, quantity: 1 }],
      notes: '',
      routeId: null,
      latitude: null,
      longitude: null,
    });
    await syncManager.enqueueOfflineOrder({
      clientId: 12,
      clientName: 'Supermercado Central',
      items: [{ productId: 2, quantity: 5 }],
      notes: 'Urgente',
      routeId: null,
      latitude: null,
      longitude: null,
    });

    let allowBadOrderNow = false;
    const executor = {
      sendOrder: vi.fn(async (payload: { clientId: number }) => {
        if (payload.clientId === 11 && !allowBadOrderNow) {
          throw new Error('Stock insuficiente o producto dado de baja');
        }
        return { id: 9100 };
      }),
      sendVisit: vi.fn(async () => ({ ok: true })),
    };

    const res = await syncManager.flushOfflineQueues(executor);
    expect(res.rejectedOrders).toBe(1);
    expect(res.syncedOrders).toBe(1);
    expect(res.remainingOrders).toBe(1);

    const snap = await syncManager.getOfflineQueueSnapshot();
    expect(snap.orders[0].id).toBe(badOrder.id);
    expect(snap.orders[0].status).toBe('REJECTED');

    allowBadOrderNow = true;
    await syncManager.retryRejectedOfflineOrder(badOrder.id);
    const retryRes = await syncManager.flushOfflineQueues(executor);
    expect(retryRes.syncedOrders).toBe(1);
    expect(retryRes.remainingOrders).toBe(0);
  });
});
