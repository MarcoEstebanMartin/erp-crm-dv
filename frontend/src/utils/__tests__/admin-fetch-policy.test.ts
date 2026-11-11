import { describe, expect, it } from 'vitest';
import {
  CATALOG_META_FRESHNESS_TTL_MS,
  PRODUCTS_FRESHNESS_TTL_MS,
  shouldFetchAdminResource,
} from '../adminFetchPolicy';

describe('Admin Fetch Policy — Transición Instantánea entre Pestañas sin Sacrificar Exactitud', () => {
  it('exige descarga inicial cuando no hay datos cargados o timestamp cero', () => {
    expect(
      shouldFetchAdminResource({
        lastFetchedAt: 0,
        hasData: false,
        ttlMs: PRODUCTS_FRESHNESS_TTL_MS,
        now: 100_000,
      }),
    ).toBe(true);

    expect(
      shouldFetchAdminResource({
        lastFetchedAt: 99_000,
        hasData: false,
        ttlMs: PRODUCTS_FRESHNESS_TTL_MS,
        now: 100_000,
      }),
    ).toBe(true);
  });

  it('evita re-descargar en cambios rápidos de pestaña dentro de la ventana de frescura', () => {
    expect(
      shouldFetchAdminResource({
        lastFetchedAt: 100_000,
        hasData: true,
        ttlMs: PRODUCTS_FRESHNESS_TTL_MS,
        now: 105_000,
      }),
    ).toBe(false);

    expect(
      shouldFetchAdminResource({
        lastFetchedAt: 100_000,
        hasData: true,
        ttlMs: PRODUCTS_FRESHNESS_TTL_MS,
        now: 100_000 + PRODUCTS_FRESHNESS_TTL_MS,
      }),
    ).toBe(true);
  });

  it('fuerza refresco inmediato al 100% cuando ocurre cualquier mutación (force=true)', () => {
    expect(
      shouldFetchAdminResource({
        lastFetchedAt: 100_000,
        hasData: true,
        ttlMs: CATALOG_META_FRESHNESS_TTL_MS,
        force: true,
        now: 100_050,
      }),
    ).toBe(true);
  });
});
