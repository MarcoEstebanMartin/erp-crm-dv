import crypto from 'crypto';

/**
 * Sistema de Caché en Memoria Ultrarrápido (Zero-Dependency)
 * Diseñado para catálogo de productos, listas de precios y ofertas.
 * Incluye invalidación instantánea por prefijo y soporte de JSON pre-serializado + ETag
 * para servir respuestas de solo lectura en <2ms sin structuredClone ni re-serialización.
 */

interface CacheItem<T> {
  value: T;
  expiresAt: number;
}

export interface HttpJsonCacheEntry {
  json: string;
  etag: string;
  expiresAt: number;
}

export const DEFAULT_CATALOG_INVALIDATION_THROTTLE_MS = 15_000;

class InMemoryCache {
  private cache = new Map<string, CacheItem<any>>();
  private serializedCache = new Map<string, HttpJsonCacheEntry>();
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
   * Guarda un payload ya serializado a JSON junto con su ETag débil (SHA-1).
   * Evita clonar (structuredClone) y re-serializar (JSON.stringify) en cada request HTTP.
   */
  setSerializedJson(key: string, payload: unknown, ttlSeconds: number = 60): HttpJsonCacheEntry {
    const json = JSON.stringify(payload);
    const hash = crypto.createHash('sha1').update(json).digest('hex').slice(0, 16);
    const entry: HttpJsonCacheEntry = {
      json,
      etag: `W/"${hash}"`,
      expiresAt: Date.now() + ttlSeconds * 1000,
    };
    this.serializedCache.set(key, entry);
    return entry;
  }

  /**
   * Obtiene una entrada HTTP pre-serializada sin clonar memoria (string inmutable).
   */
  getSerializedJson(key: string): HttpJsonCacheEntry | null {
    const entry = this.serializedCache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.serializedCache.delete(key);
      return null;
    }

    return entry;
  }

  /**
   * Elimina una clave específica de la memoria.
   */
  del(key: string): void {
    this.cache.delete(key);
    this.serializedCache.delete(key);
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
    for (const key of this.serializedCache.keys()) {
      if (key.startsWith(prefix)) {
        this.serializedCache.delete(key);
      }
    }
  }

  /**
   * Invalida todo el catálogo de productos, precios y ofertas instantáneamente.
   * Usar cuando cambian precios, datos de productos, lotes manuales o promos semanales.
   */
  invalidateProductCatalog(): void {
    let count = 0;
    const isCatalogKey = (key: string) =>
      key.startsWith('products_') ||
      key.startsWith('store_catalog_') ||
      key.startsWith('weekly_promos_');

    for (const key of this.cache.keys()) {
      if (isCatalogKey(key)) {
        this.cache.delete(key);
        count++;
      }
    }
    for (const key of this.serializedCache.keys()) {
      if (isCatalogKey(key)) {
        this.serializedCache.delete(key);
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
    const isThrottledKey = (key: string) =>
      key.startsWith('products_') || key.startsWith('store_catalog_');

    for (const key of this.cache.keys()) {
      if (isThrottledKey(key)) {
        this.cache.delete(key);
        count++;
      }
    }
    for (const key of this.serializedCache.keys()) {
      if (isThrottledKey(key)) {
        this.serializedCache.delete(key);
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
    this.serializedCache.clear();
    this.lastThrottledCatalogInvalidationAt = 0;
  }
}

export const appCache = new InMemoryCache();
