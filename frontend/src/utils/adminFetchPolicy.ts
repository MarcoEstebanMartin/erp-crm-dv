export const PRODUCTS_FRESHNESS_TTL_MS = 20_000;
export const CLIENTS_FRESHNESS_TTL_MS = 30_000;
export const CATALOG_META_FRESHNESS_TTL_MS = 120_000;

export interface ResourceFreshnessCheck {
  lastFetchedAt: number;
  hasData: boolean;
  ttlMs: number;
  force?: boolean;
  now?: number;
}

/**
 * Decide de forma determinística si una colección en memoria debe refrescarse por red.
 * - Cuando `force === true` (cualquier alta/edición/ajuste de stock/botón actualizar),
 *   SIEMPRE consulta al servidor en tiempo real (0% riesgo de saldos o stock desactualizado).
 * - En simples cambios de pestaña (`force === false`), reutiliza datos frescos en memoria
 *   para transición instantánea en 0ms.
 */
export function shouldFetchAdminResource({
  lastFetchedAt,
  hasData,
  ttlMs,
  force = false,
  now = Date.now(),
}: ResourceFreshnessCheck): boolean {
  if (force) return true;
  if (!hasData || lastFetchedAt <= 0) return true;
  return now - lastFetchedAt >= ttlMs;
}
