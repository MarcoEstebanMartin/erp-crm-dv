import { beforeEach, describe, expect, it, vi } from 'vitest';
import { appCache, DEFAULT_CATALOG_INVALIDATION_THROTTLE_MS } from '../cache';
import {
  ACTIVE_WEEKLY_PROMOS_CACHE_KEY,
  fetchActiveWeeklyPromosSafe,
} from '../../services/orders/order-weekly-promos.helper';

describe('Paso 3 — Caché inteligente de catálogo y promos semanales', () => {
  beforeEach(() => {
    appCache.clear();
  });

  it('invalidateProductCatalogThrottled agrupa ráfagas dentro de 15s y preserva weekly_promos_active', () => {
    appCache.set('products__false_light', [{ id: 1 }]);
    appCache.set('store_catalog_main', [{ id: 1 }]);
    appCache.set(ACTIVE_WEEKLY_PROMOS_CACHE_KEY, [{ id: 9 }]);

    const t0 = 1_000_000;
    const first = appCache.invalidateProductCatalogThrottled(DEFAULT_CATALOG_INVALIDATION_THROTTLE_MS, t0);
    expect(first).toBe(true);
    expect(appCache.get('products__false_light')).toBeNull();
    expect(appCache.get('store_catalog_main')).toBeNull();
    // Las promos semanales NO cambian al cargar pedidos
    expect(appCache.get(ACTIVE_WEEKLY_PROMOS_CACHE_KEY)).toEqual([{ id: 9 }]);

    // Recacheamos catálogo y disparamos otra orden 3 segundos después -> no invalida
    appCache.set('products__false_light', [{ id: 2 }]);
    const second = appCache.invalidateProductCatalogThrottled(
      DEFAULT_CATALOG_INVALIDATION_THROTTLE_MS,
      t0 + 3_000,
    );
    expect(second).toBe(false);
    expect(appCache.get('products__false_light')).toEqual([{ id: 2 }]);

    // Pasados 15 segundos -> sí invalida
    const third = appCache.invalidateProductCatalogThrottled(
      DEFAULT_CATALOG_INVALIDATION_THROTTLE_MS,
      t0 + DEFAULT_CATALOG_INVALIDATION_THROTTLE_MS,
    );
    expect(third).toBe(true);
    expect(appCache.get('products__false_light')).toBeNull();
  });

  it('invalidateProductCatalog limpia inmediatamente catálogo y promos semanales', () => {
    appCache.set('products__false_full', [{ id: 1 }]);
    appCache.set(ACTIVE_WEEKLY_PROMOS_CACHE_KEY, [{ id: 9 }]);

    appCache.invalidateProductCatalog();

    expect(appCache.get('products__false_full')).toBeNull();
    expect(appCache.get(ACTIVE_WEEKLY_PROMOS_CACHE_KEY)).toBeNull();
  });

  it('fetchActiveWeeklyPromosSafe evita re-consultar PostgreSQL cuando el caché está vigente', async () => {
    const findMany = vi.fn().mockResolvedValue([
      {
        id: 12,
        name: '3+1 Gaseosa',
        type: 'BUY_X_GET_Y',
        startDate: new Date('2026-11-20T00:00:00Z'),
        endDate: new Date('2026-11-30T23:59:59Z'),
        isActive: true,
        items: [{ productId: 5, minQuantity: 3, freeQuantity: 1, promoUnitPrice: null }],
      },
    ]);
    const mockTx = { weeklyPromo: { findMany } };

    const first = await fetchActiveWeeklyPromosSafe(mockTx, new Date('2026-11-24T12:00:00Z'), {
      useCache: true,
    });
    const second = await fetchActiveWeeklyPromosSafe(mockTx, new Date('2026-11-24T12:00:01Z'), {
      useCache: true,
    });

    expect(first).toHaveLength(1);
    expect(second).toEqual(first);
    expect(findMany).toHaveBeenCalledTimes(1);

    // Al editar promos -> invalidateProductCatalog() -> vuelve a consultar DB
    appCache.invalidateProductCatalog();
    await fetchActiveWeeklyPromosSafe(mockTx, new Date('2026-11-24T12:00:02Z'), {
      useCache: true,
    });
    expect(findMany).toHaveBeenCalledTimes(2);
  });
});
