/**
 * Sistema de Caché en Memoria Ultrarrápido (Zero-Dependency)
 * Diseñado para catálogo de productos, listas de precios y ofertas.
 * Incluye invalidación instantánea por prefijo y borrado automático al actualizar precios.
 */

interface CacheItem<T> {
  value: T;
  expiresAt: number;
}

class InMemoryCache {
  private cache = new Map<string, CacheItem<any>>();

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
   */
  invalidateProductCatalog(): void {
    let count = 0;
    for (const key of this.cache.keys()) {
      if (key.startsWith('products_') || key.startsWith('store_catalog_')) {
        this.cache.delete(key);
        count++;
      }
    }
    console.log(`⚡ [Caché System] Invalidadas ${count} entradas del catálogo de productos y precios.`);
  }

  /**
   * Vacía toda la memoria del sistema.
   */
  clear(): void {
    this.cache.clear();
  }
}

export const appCache = new InMemoryCache();
