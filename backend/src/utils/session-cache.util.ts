import { Role } from '@prisma/client';

export interface CachedStaffSession {
  id: number;
  role: Role;
  isActive: true;
}

export interface CachedStoreClientSession {
  id: number;
  isActive: true;
  isClient: true;
  priceList: string;
}

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const DEFAULT_SESSION_TTL_MS = 45_000; // 45 segundos
const MAX_SESSION_ENTRIES = 2_000;

/**
 * Caché en memoria de corta duración para validación de sesiones activas.
 * Elimina consultas repetitivas a PostgreSQL en ráfagas de peticiones HTTP,
 * garantizando invalidación instantánea (0 ms) al desactivar o editar usuarios/clientes.
 */
class SessionCache {
  private staffMap = new Map<number, CacheEntry<CachedStaffSession>>();
  private storeClientMap = new Map<number, CacheEntry<CachedStoreClientSession>>();

  private pruneMap<K, V>(map: Map<K, CacheEntry<V>>): void {
    if (map.size < MAX_SESSION_ENTRIES) return;

    const now = Date.now();
    for (const [key, entry] of map.entries()) {
      if (now > entry.expiresAt) {
        map.delete(key);
      }
    }

    if (map.size >= MAX_SESSION_ENTRIES) {
      const oldestKey = map.keys().next().value;
      if (oldestKey !== undefined) {
        map.delete(oldestKey);
      }
    }
  }

  getStaffSession(userId: number): CachedStaffSession | null {
    const entry = this.staffMap.get(userId);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.staffMap.delete(userId);
      return null;
    }

    return { ...entry.value };
  }

  setStaffSession(
    userId: number,
    session: CachedStaffSession,
    ttlMs: number = DEFAULT_SESSION_TTL_MS,
  ): void {
    if (!session.isActive) {
      this.staffMap.delete(userId);
      return;
    }
    this.pruneMap(this.staffMap);
    this.staffMap.set(userId, {
      value: { ...session },
      expiresAt: Date.now() + ttlMs,
    });
  }

  invalidateStaffSession(userId: number): void {
    this.staffMap.delete(Number(userId));
  }

  getStoreClientSession(personaId: number): CachedStoreClientSession | null {
    const entry = this.storeClientMap.get(personaId);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.storeClientMap.delete(personaId);
      return null;
    }

    return { ...entry.value };
  }

  setStoreClientSession(
    personaId: number,
    session: CachedStoreClientSession,
    ttlMs: number = DEFAULT_SESSION_TTL_MS,
  ): void {
    if (!session.isActive || !session.isClient) {
      this.storeClientMap.delete(personaId);
      return;
    }
    this.pruneMap(this.storeClientMap);
    this.storeClientMap.set(personaId, {
      value: { ...session },
      expiresAt: Date.now() + ttlMs,
    });
  }

  invalidateStoreClientSession(personaId: number): void {
    this.storeClientMap.delete(Number(personaId));
  }

  clear(): void {
    this.staffMap.clear();
    this.storeClientMap.clear();
  }
}

export const sessionCache = new SessionCache();
