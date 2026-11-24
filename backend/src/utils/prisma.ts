import { Prisma, PrismaClient } from '@prisma/client';

export const SLOW_QUERY_THRESHOLD_MS = 200;
export const DEFAULT_PRISMA_CONNECTION_LIMIT = '15';
export const DEFAULT_PRISMA_POOL_TIMEOUT = '20';
export const DEFAULT_PRISMA_TX_MAX_WAIT_MS = 10_000;
export const DEFAULT_PRISMA_TX_TIMEOUT_MS = 15_000;

/**
 * Configura maxWait y timeout para transacciones interactivas ($transaction),
 * evitando errores P2028 ("Unable to start a transaction in the given time")
 * bajo picos de concurrencia o latencia con el pooler de Supabase.
 */
export function resolvePrismaTransactionOptions(
  rawMaxWait: string | undefined = process.env.PRISMA_TX_MAX_WAIT_MS,
  rawTimeout: string | undefined = process.env.PRISMA_TX_TIMEOUT_MS,
): { maxWait: number; timeout: number } {
  const parsedMaxWait = Number(rawMaxWait);
  const parsedTimeout = Number(rawTimeout);
  return {
    maxWait:
      Number.isFinite(parsedMaxWait) && parsedMaxWait >= 1_000
        ? Math.floor(parsedMaxWait)
        : DEFAULT_PRISMA_TX_MAX_WAIT_MS,
    timeout:
      Number.isFinite(parsedTimeout) && parsedTimeout >= 2_000
        ? Math.floor(parsedTimeout)
        : DEFAULT_PRISMA_TX_TIMEOUT_MS,
  };
}

/**
 * Ajusta DATABASE_URL para el pooler de Supabase (Supavisor :6543) evitando
 * colas o errores de prepared statements en Railway y desarrollo local.
 */
export function resolvePooledDatabaseUrl(
  rawUrl: string | undefined = process.env.DATABASE_URL,
  connectionLimit: string = process.env.PRISMA_CONNECTION_LIMIT || DEFAULT_PRISMA_CONNECTION_LIMIT,
): string | undefined {
  if (!rawUrl || !rawUrl.trim()) return undefined;

  try {
    const parsed = new URL(rawUrl);
    const isSupabasePooler =
      parsed.port === '6543' || parsed.hostname.includes('pooler.supabase.com');

    if (isSupabasePooler) {
      if (parsed.port === '6543' && !parsed.searchParams.has('pgbouncer')) {
        parsed.searchParams.set('pgbouncer', 'true');
      }
      if (!parsed.searchParams.has('connection_limit')) {
        parsed.searchParams.set('connection_limit', connectionLimit);
      }
      if (!parsed.searchParams.has('pool_timeout')) {
        parsed.searchParams.set('pool_timeout', DEFAULT_PRISMA_POOL_TIMEOUT);
      }
    }
    return parsed.toString();
  } catch {
    return rawUrl;
  }
}

export function resolvePrismaLogConfig(
  nodeEnv: string | undefined = process.env.NODE_ENV,
  logAllQueries: boolean = process.env.PRISMA_LOG_QUERIES === 'true',
): (Prisma.LogLevel | Prisma.LogDefinition)[] {
  if (nodeEnv !== 'development') {
    return ['error'];
  }
  if (logAllQueries) {
    return ['query', 'warn', 'error'];
  }
  return [
    { emit: 'event', level: 'query' },
    { emit: 'stdout', level: 'warn' },
    { emit: 'stdout', level: 'error' },
  ];
}

const isDevWithoutFullSqlLog =
  process.env.NODE_ENV === 'development' && process.env.PRISMA_LOG_QUERIES !== 'true';
const pooledUrl = resolvePooledDatabaseUrl();

const prisma = new PrismaClient({
  log: resolvePrismaLogConfig(),
  transactionOptions: resolvePrismaTransactionOptions(),
  ...(pooledUrl ? { datasources: { db: { url: pooledUrl } } } : {}),
});

if (isDevWithoutFullSqlLog) {
  (prisma as any).$on('query', (event: { duration: number; query: string }) => {
    if (event.duration >= SLOW_QUERY_THRESHOLD_MS) {
      const compactSql = event.query.replace(/\s+/g, ' ').slice(0, 180);
      console.warn(`⚠️ [SQL Lento ${event.duration}ms] ${compactSql}`);
    }
  });
}

export default prisma;
