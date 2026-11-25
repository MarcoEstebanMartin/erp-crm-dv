import { appCache } from '../../utils/cache';

export const REPORT_FINANCE_TTL_SECONDS = 120;
export const REPORT_PROFITABILITY_TTL_SECONDS = 120;
export const REPORT_ZONES_TTL_SECONDS = 180;
export const REPORT_TRIPS_TTL_SECONDS = 120;
export const REPORT_OPPORTUNITIES_TTL_SECONDS = 600;

const inFlightReportPromises = new Map<string, Promise<unknown>>();

function normalizeParamValue(value: unknown): string {
  if (value === undefined || value === null || value === '') return '';
  if (Array.isArray(value)) {
    return [...value]
      .map((item) => String(item ?? '').trim())
      .filter(Boolean)
      .sort()
      .join(',');
  }
  return String(value).trim();
}

export function buildReportCacheKey(
  reportName: string,
  params: Record<string, unknown> = {},
): string {
  const entries = Object.keys(params)
    .sort()
    .map((key) => `${key}=${normalizeParamValue(params[key])}`)
    .filter((segment) => !segment.endsWith('='));
  return `report:${reportName}:${entries.join('&') || 'default'}`;
}

/**
 * Ejecuta un reporte con caché en memoria (TTL corto) y coalescing in-flight (singleflight):
 * si varios usuarios consultan el mismo reporte mientras está frío, solo se ejecuta 1 consulta SQL
 * y todos comparten el resultado, protegiendo el pool de conexiones de PostgreSQL.
 */
export async function withReportCache<T>(
  reportName: string,
  params: Record<string, unknown>,
  ttlSeconds: number,
  compute: () => Promise<T>,
  options?: { bypassCache?: boolean },
): Promise<T> {
  const isTestEnv = process.env.VITEST === 'true' || process.env.NODE_ENV === 'test';
  const shouldUseCache = !(options?.bypassCache ?? isTestEnv);
  const cacheKey = buildReportCacheKey(reportName, params);

  if (shouldUseCache) {
    const cached = appCache.get<T>(cacheKey);
    if (cached !== null) {
      return cached;
    }

    const existingPromise = inFlightReportPromises.get(cacheKey);
    if (existingPromise) {
      return existingPromise as Promise<T>;
    }
  }

  const executionPromise = (async () => {
    const result = await compute();
    if (shouldUseCache && ttlSeconds > 0) {
      appCache.set(cacheKey, result, ttlSeconds);
    }
    return result;
  })();

  if (shouldUseCache) {
    inFlightReportPromises.set(cacheKey, executionPromise);
  }

  try {
    return await executionPromise;
  } finally {
    if (inFlightReportPromises.get(cacheKey) === executionPromise) {
      inFlightReportPromises.delete(cacheKey);
    }
  }
}

export function invalidateReportCache(reportName?: string): void {
  const prefix = reportName ? `report:${reportName}:` : 'report:';
  appCache.invalidateByPrefix(prefix);
}
