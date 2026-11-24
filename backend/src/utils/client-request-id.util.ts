const SAFE_CLIENT_REQUEST_ID_REGEX = /^[A-Za-z0-9\-_.:]+$/;
const MIN_LENGTH = 8;
const MAX_LENGTH = 128;

/**
 * Normaliza y valida una clave de idempotencia proveniente de header HTTP (`Idempotency-Key`)
 * o del cuerpo del request (`clientRequestId` / `idempotencyKey`).
 * Devuelve `undefined` si no está presente o no cumple el formato seguro.
 */
export function normalizeClientRequestId(...candidates: unknown[]): string | undefined {
  for (const candidate of candidates) {
    if (typeof candidate !== 'string') continue;
    const trimmed = candidate.trim().slice(0, MAX_LENGTH);
    if (trimmed.length >= MIN_LENGTH && SAFE_CLIENT_REQUEST_ID_REGEX.test(trimmed)) {
      return trimmed;
    }
  }
  return undefined;
}

/**
 * Detecta si un error de Prisma corresponde a una colisión de índice único (P2002)
 * específicamente sobre la columna `clientRequestId`.
 */
export function isClientRequestIdUniqueConflict(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const prismaErr = error as { code?: unknown; meta?: { target?: unknown } };
  if (prismaErr.code !== 'P2002') return false;

  const target = prismaErr.meta?.target;
  if (Array.isArray(target)) {
    return target.some((entry) => String(entry).includes('clientRequestId'));
  }
  if (typeof target === 'string') {
    return target.includes('clientRequestId');
  }
  return false;
}
