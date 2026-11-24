/**
 * Sistema de Caché en Memoria Ultrarrápido (Zero-Dependency)
 * Diseñado para catálogo de productos, listas de precios y ofertas.
 * Incluye invalidación instantánea por prefijo y borrado automático al actualizar precios.
 */

interface CacheItem<T> {
  value: T;
  expiresAt: number;
}

export const DEFAULT_CATALOG_INVALIDATION_THROTTLE_MS = 15_000;

class InMemoryCache {
  private cache = new Map<string, CacheItem<any>>();
  private lastThrottledCatalogInvalidationAt = 0;

  /**
   * Obtiene un valor de la memoria si existe y no ha expirado.
   */
  get<T>(key: string): T | null {
    const item = this.cache.get(key);
    if (!item) return null;

    if (Date.now() > item.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    if (typeof item.value === 'object' && item.value !== null) {
      try {
        return structuredClone(item.value) as T;
      } catch {
        return JSON.parse(JSON.stringify(item.value)) as T;
      }
    }
    return item.value as T;
  }

  /**
   * Guarda un valor en memoria con un tiempo de vida (TTL) en segundos.
   * Por defecto TTL = 24 horas (86400 segundos).
   */
  set<T>(key: string, value: T, ttlSeconds: number = 86400): void {
    const expiresAt = Date.now() + ttlSeconds * 1000;
    this.cache.set(key, { value, expiresAt });
  }

  /**
   * Elimina una clave específica de la memoria.
   */
  del(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Elimina todas las claves que comiencen con un prefijo determinado.
   */
  invalidateByPrefix(prefix: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Invalida todo el catálogo de productos, precios y ofertas instantáneamente.
   * Usar cuando cambian precios, datos de productos, lotes manuales o promos semanales.
   */
  invalidateProductCatalog(): void {
    let count = 0;
    for (const key of this.cache.keys()) {
      if (
        key.startsWith('products_') ||
        key.startsWith('store_catalog_') ||
        key.startsWith('weekly_promos_')
      ) {
        this.cache.delete(key);
        count++;
      }
    }
    this.lastThrottledCatalogInvalidationAt = Date.now();
    if (count > 0) {
      console.log(`⚡ [Caché System] Invalidadas ${count} entradas del catálogo de productos y precios.`);
    }
  }

  /**
   * Invalidación suavizada para movimientos de stock por pedidos de alta frecuencia (ej. 700/día).
   * Evita vaciar el catálogo decenas de veces por minuto durante picos de preventa:
   * invalida como máximo una vez cada `windowMs` (por defecto 15s) y preserva el caché de promos.
   * El control real de stock al crear pedidos siempre consulta PostgreSQL dentro de la transacción.
   */
  invalidateProductCatalogThrottled(
    windowMs: number = DEFAULT_CATALOG_INVALIDATION_THROTTLE_MS,
    nowMs: number = Date.now(),
  ): boolean {
    if (
      this.lastThrottledCatalogInvalidationAt > 0 &&
      nowMs - this.lastThrottledCatalogInvalidationAt < windowMs
    ) {
      return false;
    }

    let count = 0;
    for (const key of this.cache.keys()) {
      if (key.startsWith('products_') || key.startsWith('store_catalog_')) {
        this.cache.delete(key);
        count++;
      }
    }
    this.lastThrottledCatalogInvalidationAt = nowMs;
    if (count > 0) {
      console.log(`⚡ [Caché System] Invalidación suavizada de catálogo (${count} entradas).`);
    }
    return true;
  }

  /**
   * Vacía toda la memoria del sistema.
   */
  clear(): void {
    this.cache.clear();
    this.lastThrottledCatalogInvalidationAt = 0;
  }
}

export const appCache = new InMemoryCache();
