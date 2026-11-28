import { BillingType } from '@prisma/client';
import { Decimal } from 'decimal.js';
import { roundToIntegerPeso } from '../../core/money';
import {
  addDaysIso,
  DEFAULT_WEEKLY_FIXED_CONCEPTS,
  DEFAULT_WEEKLY_HABITUAL_SUPPLIERS,
  getWorkWeekBounds,
  normalizePulseCompanyKey,
} from '../../engines/weekly-pulse.engine';
import { getArgentinaTodayParts, normalizeCity } from './admin-report.helpers';

export interface StoredPurchasesMeta {
  manualItems: Array<{ id: string; company: string; date: string; amount: number }>;
  excludedSourceKeys: string[];
  manualOpeningCredit: number | null;
  fixedInitialized: boolean;
}

export interface StoredSalesMeta {
  manualItems: Array<{ id: string; locality: string; date: string; amountA: number; amountX: number }>;
}

export interface CityBucket {
  locality: string;
  amountA: Decimal;
  amountX: Decimal;
  lastDate: string;
  ordersCount: number;
}

export function parsePurchasesMeta(raw: unknown): StoredPurchasesMeta {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const obj = raw as Record<string, unknown>;
    const manualItems = Array.isArray(obj.manualItems)
      ? obj.manualItems
          .filter((x): x is Record<string, unknown> => Boolean(x && typeof x === 'object'))
          .map((x, idx) => ({
            id: typeof x.id === 'string' && x.id ? x.id : `mp-${idx}`,
            company: String(x.company || '').trim(),
            date: String(x.date || ''),
            amount: roundToIntegerPeso(Number(x.amount || 0)).toNumber(),
          }))
          .filter((x) => x.company.length > 0)
      : [];
    const excludedSourceKeys = Array.isArray(obj.excludedSourceKeys)
      ? obj.excludedSourceKeys.filter((k): k is string => typeof k === 'string' && k.length > 0)
      : [];
    const manualOpeningCredit =
      typeof obj.manualOpeningCredit === 'number' && Number.isFinite(obj.manualOpeningCredit)
        ? roundToIntegerPeso(obj.manualOpeningCredit).toNumber()
        : null;
    const fixedInitialized = Boolean(obj.fixedInitialized);
    return { manualItems, excludedSourceKeys, manualOpeningCredit, fixedInitialized };
  }
  return { manualItems: [], excludedSourceKeys: [], manualOpeningCredit: null, fixedInitialized: false };
}

export function parseSalesMeta(raw: unknown): StoredSalesMeta {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const obj = raw as Record<string, unknown>;
    const manualItems = Array.isArray(obj.manualItems)
      ? obj.manualItems
          .filter((x): x is Record<string, unknown> => Boolean(x && typeof x === 'object'))
          .map((x, idx) => ({
            id: typeof x.id === 'string' && x.id ? x.id : `ms-${idx}`,
            locality: String(x.locality || '').trim(),
            date: String(x.date || ''),
            amountA: roundToIntegerPeso(Number(x.amountA || 0)).toNumber(),
            amountX: roundToIntegerPeso(Number(x.amountX || 0)).toNumber(),
          }))
          .filter((x) => x.locality.length > 0)
      : [];
    return { manualItems };
  }
  return { manualItems: [] };
}

export function formatIsoAr(dt: Date): string {
  return getArgentinaTodayParts(dt).isoDate;
}

export function listWeekStartsBetween(fromMonday: string, toMonday: string): string[] {
  const weeks: string[] = [];
  let cursor = fromMonday;
  let guard = 0;
  while (cursor <= toMonday && guard < 120) {
    weeks.push(cursor);
    cursor = addDaysIso(cursor, 7);
    guard += 1;
  }
  return weeks;
}

export function accumulateCitySaleBucket(
  autoSalesByWeek: Map<string, Map<string, CityBucket>>,
  createdAt: Date,
  cityRaw: string | null | undefined,
  billingType: BillingType,
  signedAmount: Decimal,
  isOrder: boolean,
): void {
  const dateIso = formatIsoAr(createdAt);
  const { weekStart } = getWorkWeekBounds(dateIso);
  const locality = normalizeCity(cityRaw);
  let cityMap = autoSalesByWeek.get(weekStart);
  if (!cityMap) {
    cityMap = new Map();
    autoSalesByWeek.set(weekStart, cityMap);
  }
  const existing = cityMap.get(locality) ?? {
    locality,
    amountA: new Decimal(0),
    amountX: new Decimal(0),
    lastDate: dateIso,
    ordersCount: 0,
  };
  if (billingType === BillingType.OFFICIAL) {
    existing.amountA = existing.amountA.plus(signedAmount);
  } else {
    existing.amountX = existing.amountX.plus(signedAmount);
  }
  if (dateIso > existing.lastDate) existing.lastDate = dateIso;
  if (isOrder) existing.ordersCount += 1;
  cityMap.set(locality, existing);
}

/**
 * Construye el catálogo de proveedores habituales (botón 1-clic) y la lista completa
 * de sugerencias para autocompletado combinando defaults, proveedores activos e historial.
 */
export function buildPulseCompanyCatalogs(params: {
  providerNames: string[];
  historicalManualNames: string[];
  historicalInvoiceNames: string[];
}): { habitualCompanies: string[]; suggestedCompanies: string[] } {
  const fixedSet = new Set(DEFAULT_WEEKLY_FIXED_CONCEPTS.map(normalizePulseCompanyKey));

  const habitualList: string[] = [];
  const habitualSeen = new Set<string>();
  for (const name of DEFAULT_WEEKLY_HABITUAL_SUPPLIERS) {
    const key = normalizePulseCompanyKey(name);
    if (!key || habitualSeen.has(key)) continue;
    habitualSeen.add(key);
    habitualList.push(key);
  }

  // Sumar al catálogo de habituales cualquier empresa usada 2+ veces en semanas previas
  const freq = new Map<string, number>();
  for (const raw of [...params.historicalManualNames, ...params.historicalInvoiceNames]) {
    const key = normalizePulseCompanyKey(raw);
    if (!key || fixedSet.has(key) || habitualSeen.has(key)) continue;
    freq.set(key, (freq.get(key) ?? 0) + 1);
  }
  for (const [key, count] of freq.entries()) {
    if (count >= 2) {
      habitualSeen.add(key);
      habitualList.push(key);
    }
  }

  const suggestedSet = new Set<string>([
    ...DEFAULT_WEEKLY_FIXED_CONCEPTS.map(normalizePulseCompanyKey),
    ...habitualList,
  ]);
  for (const raw of [
    ...params.providerNames,
    ...params.historicalManualNames,
    ...params.historicalInvoiceNames,
  ]) {
    const key = normalizePulseCompanyKey(raw);
    if (key) suggestedSet.add(key);
  }

  return {
    habitualCompanies: habitualList,
    suggestedCompanies: Array.from(suggestedSet).sort((a, b) => a.localeCompare(b, 'es')),
  };
}
