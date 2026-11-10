import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';

interface StoredIdempotencyRecord {
  state: 'PROCESSING' | 'COMPLETED';
  payloadHash: string;
  startedAt: number;
  expiresAt: number;
  statusCode?: number;
  responseBody?: any;
}

const EXPLICIT_KEY_TTL_MS = 24 * 60 * 60 * 1000; // 24 horas para reintentos explícitos / offline
const AUTO_FINGERPRINT_TTL_MS = 3_000; // 3 segundos anti-doble clic automático sin cabecera
const IN_FLIGHT_TIMEOUT_MS = 60_000; // 60s tope de bloqueo si una petición colapsa
const MAX_IDEMPOTENCY_RECORDS = 5_000;

const idempotencyStore = new Map<string, StoredIdempotencyRecord>();

const cleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [key, record] of idempotencyStore.entries()) {
    const expired =
      now > record.expiresAt ||
      (record.state === 'PROCESSING' && now - record.startedAt > IN_FLIGHT_TIMEOUT_MS);
    if (expired) {
      idempotencyStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

if (typeof cleanupInterval.unref === 'function') {
  cleanupInterval.unref();
}

export function clearIdempotencyStore(): void {
  idempotencyStore.clear();
}

function stableSerialize(value: any): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return '[' + value.map((item) => stableSerialize(item)).join(',') + ']';
  }
  const sortedKeys = Object.keys(value).sort();
  const entries = sortedKeys.map(
    (k) => `${JSON.stringify(k)}:${stableSerialize(value[k])}`,
  );
  return '{' + entries.join(',') + '}';
}

function resolveActorScope(req: any): string {
  if (req.user?.id) return `staff:${req.user.id}`;
  if (req.storeClient?.personaId) return `store:${req.storeClient.personaId}`;
  if (req.staffUser?.id) return `staff:${req.staffUser.id}`;
  return `ip:${req.ip || req.socket?.remoteAddress || 'anon'}`;
}

function ensureStoreCapacity(now: number): void {
  if (idempotencyStore.size < MAX_IDEMPOTENCY_RECORDS) return;
  for (const [key, record] of idempotencyStore.entries()) {
    if (now > record.expiresAt) {
      idempotencyStore.delete(key);
    }
  }
  if (idempotencyStore.size >= MAX_IDEMPOTENCY_RECORDS) {
    const oldest = idempotencyStore.keys().next().value;
    if (oldest !== undefined) idempotencyStore.delete(oldest);
  }
}

/**
 * Middleware Bancario Anti-Doble Clic e Idempotencia Transaccional.
 * - Con cabecera `Idempotency-Key`: recuerda respuestas exitosas 24h (ideal para 4G inestable y modo Offline).
 * - Sin cabecera: aplica huella SHA-256 automática de 3s para bloquear dobles clics involuntarios.
 */
export function idempotencyGuard(req: Request, res: Response, next: NextFunction): void {
  const method = (req.method || 'GET').toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    next();
    return;
  }

  const actorScope = resolveActorScope(req);
  const routeSignature = `${method}:${req.baseUrl || ''}${req.path || req.url || ''}`;
  const payloadHash = crypto
    .createHash('sha256')
    .update(`${routeSignature}|${stableSerialize(req.body ?? {})}`)
    .digest('hex');

  const rawHeader = req.headers['idempotency-key'];
  const headerKey =
    typeof rawHeader === 'string' ? rawHeader.trim().slice(0, 128) : '';
  const hasExplicitKey = headerKey.length >= 8 && /^[A-Za-z0-9\-_.:]+$/.test(headerKey);

  const storageKey = hasExplicitKey
    ? `explicit|${actorScope}|${routeSignature}|${headerKey}`
    : `auto|${actorScope}|${payloadHash}`;

  const now = Date.now();
  const existing = idempotencyStore.get(storageKey);

  if (existing) {
    const isStaleProcessing =
      existing.state === 'PROCESSING' && now - existing.startedAt > IN_FLIGHT_TIMEOUT_MS;
    const isExpired = now > existing.expiresAt || isStaleProcessing;

    if (isExpired) {
      idempotencyStore.delete(storageKey);
    } else if (hasExplicitKey && existing.payloadHash !== payloadHash) {
      res.status(422).json({
        status: 'error',
        message:
          'La clave Idempotency-Key ya fue utilizada con datos diferentes en otra operación.',
        code: 'IDEMPOTENCY_PAYLOAD_MISMATCH',
      });
      return;
    } else if (existing.state === 'PROCESSING') {
      res.status(409).json({
        status: 'error',
        message:
          'Esta operación ya se está procesando en este instante. Aguardá unos segundos para evitar duplicados.',
        code: 'IDEMPOTENT_IN_PROGRESS',
      });
      return;
    } else if (existing.state === 'COMPLETED' && existing.statusCode !== undefined) {
      if (typeof res.setHeader === 'function') {
        res.setHeader('X-Idempotency-Replayed', 'true');
      }
      res.status(existing.statusCode).json(existing.responseBody);
      return;
    }
  }

  ensureStoreCapacity(now);
  const ttlMs = hasExplicitKey ? EXPLICIT_KEY_TTL_MS : AUTO_FINGERPRINT_TTL_MS;
  const record: StoredIdempotencyRecord = {
    state: 'PROCESSING',
    payloadHash,
    startedAt: now,
    expiresAt: now + ttlMs,
  };
  idempotencyStore.set(storageKey, record);

  let trackedStatus: number | undefined;
  if (typeof res.status === 'function') {
    const originalStatus = res.status.bind(res);
    res.status = ((code: number) => {
      trackedStatus = code;
      return originalStatus(code);
    }) as any;
  }

  const originalJson = res.json.bind(res);
  res.json = ((body: any) => {
    const currentStatus = trackedStatus ?? res.statusCode ?? 200;
    if (currentStatus >= 200 && currentStatus < 300) {
      record.state = 'COMPLETED';
      record.statusCode = currentStatus;
      record.responseBody = body;
      record.expiresAt = Date.now() + ttlMs;
      if (hasExplicitKey && typeof res.setHeader === 'function') {
        res.setHeader('Idempotency-Key', headerKey);
      }
    } else {
      // Si hubo error de validación o negocio (4xx/5xx), liberar bloqueo de inmediato
      idempotencyStore.delete(storageKey);
    }
    return originalJson(body);
  }) as any;

  if (typeof res.on === 'function') {
    res.on('close', () => {
      const current = idempotencyStore.get(storageKey);
      if (current && current.state === 'PROCESSING') {
        idempotencyStore.delete(storageKey);
      }
    });
  }

  next();
}
