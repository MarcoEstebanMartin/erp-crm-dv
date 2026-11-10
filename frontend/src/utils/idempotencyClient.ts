const CLIENT_DEDUP_WINDOW_MS = 3_000;

interface RecentKeyEntry {
  key: string;
  expiresAt: number;
}

const recentMutationKeys = new Map<string, RecentKeyEntry>();

/**
 * Genera un UUID v4 criptográfico seguro incluso en contextos HTTP de red WiFi local
 * (donde crypto.randomUUID puede no estar disponible fuera de localhost/HTTPS).
 */
export function generateSafeIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
  return `idem-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

/**
 * Devuelve una clave Idempotency-Key estable durante una ventana corta de 3 segundos
 * para el mismo endpoint + payload (atrapa dobles clics y microcortes 4G),
 * o respeta una clave explícita persistente (cola Offline PWA).
 */
export function resolveRequestIdempotencyKey(
  method: string,
  endpoint: string,
  serializedBody?: string,
  explicitKey?: string,
): string {
  if (explicitKey && explicitKey.trim().length >= 8) {
    return explicitKey.trim();
  }

  const now = Date.now();
  for (const [sig, entry] of recentMutationKeys.entries()) {
    if (now > entry.expiresAt) {
      recentMutationKeys.delete(sig);
    }
  }

  const signature = `${method.toUpperCase()}|${endpoint}|${serializedBody || ''}`;
  const existing = recentMutationKeys.get(signature);
  if (existing && now <= existing.expiresAt) {
    return existing.key;
  }

  const freshKey = generateSafeIdempotencyKey();
  recentMutationKeys.set(signature, {
    key: freshKey,
    expiresAt: now + CLIENT_DEDUP_WINDOW_MS,
  });
  return freshKey;
}

export function evictRequestIdempotencyKey(
  method: string,
  endpoint: string,
  serializedBody?: string,
): void {
  const signature = `${method.toUpperCase()}|${endpoint}|${serializedBody || ''}`;
  recentMutationKeys.delete(signature);
}
