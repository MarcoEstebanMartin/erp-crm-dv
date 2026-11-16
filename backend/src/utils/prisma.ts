import { Prisma, PrismaClient } from '@prisma/client';

export const SLOW_QUERY_THRESHOLD_MS = 200;

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

const prisma = new PrismaClient({
  log: resolvePrismaLogConfig(),
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
