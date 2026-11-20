import type { Product, ProductLot } from '../../types';
import {
  extractCleanLotNumber,
  formatCleanExpirationDate,
  isSentinelExpiration,
} from '../stock/lotLabel';
import { extractBaseSlotFromLocation, extractSlotLevels } from './warehouseLayoutMerger';
import { isRealWmsSlotLocation } from './wmsStockBreakdown';

export type RackLevel = 'A' | 'B' | 'C' | 'D' | 'E' | 'F';
export type SlotHealthStatus = 'EMPTY' | 'OK' | 'EXPIRING_SOON' | 'EXPIRED';

export interface SlotStockSummary {
  totalStock: number;
  itemsCount: number;
  hasStock: boolean;
  levels: Set<string>;
  health: SlotHealthStatus;
  expiredCount: number;
  expiringSoonCount: number;
}

export interface UnassignedTrayItem {
  key: string;
  product: Product;
  lotId: number | null;
  lotNumber: string;
  expirationDate: string | null;
  units: number;
  health: 'OK' | 'EXPIRING_SOON' | 'EXPIRED';
}

export interface LevelMixWarning {
  kind: 'OTHER_PRODUCT' | 'OTHER_EXPIRATION';
  message: string;
}

export function evaluateLotDateHealth(
  expirationDate?: string | Date | null,
  refDate: Date = new Date(),
): 'OK' | 'EXPIRING_SOON' | 'EXPIRED' {
  if (!expirationDate || isSentinelExpiration(expirationDate)) return 'OK';
  const exp = expirationDate instanceof Date ? expirationDate : new Date(expirationDate);
  if (Number.isNaN(exp.getTime())) return 'OK';

  const expDay = Date.UTC(exp.getUTCFullYear(), exp.getUTCMonth(), exp.getUTCDate());
  const refDay = Date.UTC(
    refDate.getUTCFullYear(),
    refDate.getUTCMonth(),
    refDate.getUTCDate(),
  );
  if (expDay <= refDay) return 'EXPIRED';

  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
  if (expDay - refDay <= thirtyDaysMs) return 'EXPIRING_SOON';
  return 'OK';
}

export function buildSlotStockSummaryMap(
  products: Product[],
  refDate: Date = new Date(),
): Record<string, SlotStockSummary> {
  const map: Record<string, SlotStockSummary> = {};

  const ensureSlot = (baseCode: string): SlotStockSummary => {
    if (!map[baseCode]) {
      map[baseCode] = {
        totalStock: 0,
        itemsCount: 0,
        hasStock: true,
        levels: new Set<string>(),
        health: 'OK',
        expiredCount: 0,
        expiringSoonCount: 0,
      };
    }
    return map[baseCode];
  };

  for (const p of products || []) {
    const lots = Array.isArray(p.lots) ? p.lots : [];
    if (lots.length > 0) {
      for (const l of lots) {
        const baseCode = extractBaseSlotFromLocation(l.location);
        if (Number(l.stock || 0) > 0 && baseCode) {
          const entry = ensureSlot(baseCode);
          entry.totalStock += Number(l.stock || 0);
          entry.itemsCount += 1;
          const parts = String(l.location || '').trim().toUpperCase().split('-');
          entry.levels.add(parts[3] || 'A');
          const lotHealth = evaluateLotDateHealth(l.expirationDate, refDate);
          if (lotHealth === 'EXPIRED') {
            entry.expiredCount += 1;
            entry.health = 'EXPIRED';
          } else if (lotHealth === 'EXPIRING_SOON') {
            entry.expiringSoonCount += 1;
            if (entry.health !== 'EXPIRED') entry.health = 'EXPIRING_SOON';
          }
        }
      }
    } else {
      const baseCode = extractBaseSlotFromLocation(p.defaultLocation);
      const fallbackQty = Number(p.stock || 0);
      if (fallbackQty > 0 && baseCode) {
        const entry = ensureSlot(baseCode);
        entry.totalStock += fallbackQty;
        entry.itemsCount += 1;
        const parts = String(p.defaultLocation || '').trim().toUpperCase().split('-');
        entry.levels.add(parts[3] || 'A');
      }
    }
  }

  return map;
}

export const FILTERABLE_SECTOR_KEYS = [
  'ESTANTERIA',
  'RACK_ENTRADA',
  'CAMARA_1',
  'CAMARA_2',
  'CAMARA_3',
  'BANO',
] as const;

export function formatCompactSlotLevels(levelsStr: string): string {
  const parsed = extractSlotLevels(levelsStr);
  if (parsed.length >= 2) {
    return `${parsed[0]}–${parsed[parsed.length - 1]}`;
  }
  return parsed[0] || levelsStr;
}

export function resolveWarehouseForSector(sectorKey: string): 'D1' | 'D2' | 'D3' {
  if (sectorKey === 'D2_GENERAL') return 'D2';
  if (sectorKey === 'D3_GENERAL') return 'D3';
  return 'D1';
}

export function buildUnassignedTrayEntries(
  products: Product[],
  refDate: Date = new Date(),
): UnassignedTrayItem[] {
  const items: UnassignedTrayItem[] = [];

  for (const p of products || []) {
    const lots = Array.isArray(p.lots) ? p.lots : [];
    if (lots.length > 0) {
      for (const l of lots) {
        const qty = Math.max(0, Math.trunc(Number(l.stock || 0)));
        if (qty <= 0 || isRealWmsSlotLocation(l.location)) continue;
        items.push({
          key: `lot-${l.id}`,
          product: p,
          lotId: l.id,
          lotNumber: extractCleanLotNumber(l.lotNumber),
          expirationDate: l.expirationDate || null,
          units: qty,
          health: evaluateLotDateHealth(l.expirationDate, refDate),
        });
      }
    } else {
      const qty = Math.max(0, Math.trunc(Number(p.stock || 0)));
      if (qty > 0 && !isRealWmsSlotLocation(p.defaultLocation)) {
        items.push({
          key: `prod-${p.id}`,
          product: p,
          lotId: null,
          lotNumber: 'S/L',
          expirationDate: null,
          units: qty,
          health: 'OK',
        });
      }
    }
  }

  return items.sort((a, b) => {
    const aSent = isSentinelExpiration(a.expirationDate);
    const bSent = isSentinelExpiration(b.expirationDate);
    if (aSent !== bSent) return aSent ? 1 : -1;
    if (!aSent && !bSent) {
      const tA = new Date(a.expirationDate as string).getTime();
      const tB = new Date(b.expirationDate as string).getTime();
      if (tA !== tB) return tA - tB;
    }
    return a.product.name.localeCompare(b.product.name);
  });
}

function toUtcDateKey(expirationDate?: string | Date | null): string {
  if (!expirationDate || isSentinelExpiration(expirationDate)) return 'SENTINEL';
  const parsed = expirationDate instanceof Date ? expirationDate : new Date(expirationDate);
  if (Number.isNaN(parsed.getTime())) return 'SENTINEL';
  return `${parsed.getUTCFullYear()}-${String(parsed.getUTCMonth() + 1).padStart(2, '0')}-${String(parsed.getUTCDate()).padStart(2, '0')}`;
}

export function computeLevelMixWarning(
  levelItems: Array<{ product: Product; lot: ProductLot }>,
  candidate: { productId: number | ''; lotNumber?: string; expirationDate?: string | null },
): LevelMixWarning | null {
  if (!levelItems || levelItems.length === 0 || candidate.productId === '') return null;
  const candidatePid = Number(candidate.productId);

  const otherProdItems = levelItems.filter((item) => item.product.id !== candidatePid);
  if (otherProdItems.length > 0) {
    const preview = otherProdItems
      .slice(0, 2)
      .map((i) => `${i.product.name} (${i.lot.stock} u.)`)
      .join(', ');
    const extra = otherProdItems.length > 2 ? ` y ${otherProdItems.length - 2} más` : '';
    return {
      kind: 'OTHER_PRODUCT',
      message: `Este nivel ya tiene otro producto: ${preview}${extra}. Confirmá antes de ubicar al lado.`,
    };
  }

  const candidateExpKey = toUtcDateKey(candidate.expirationDate);
  const candidateLot = candidate.lotNumber ? extractCleanLotNumber(candidate.lotNumber) : '';
  const conflict = levelItems.find((item) => {
    const existingExpKey = toUtcDateKey(item.lot.expirationDate);
    const existingLot = extractCleanLotNumber(item.lot.lotNumber);
    if (candidateExpKey !== existingExpKey) return true;
    if (
      candidateLot &&
      candidateLot !== 'S/L' &&
      existingLot !== 'S/L' &&
      candidateLot.toUpperCase() !== existingLot.toUpperCase()
    ) {
      return true;
    }
    return false;
  });

  if (conflict) {
    const cleanLot = extractCleanLotNumber(conflict.lot.lotNumber);
    const expTxt = formatCleanExpirationDate(conflict.lot.expirationDate);
    return {
      kind: 'OTHER_EXPIRATION',
      message: `Este nivel ya tiene ${conflict.lot.stock} u. de este producto (Lote ${cleanLot} · ${expTxt}). Se mantendrá como lote separado en este nivel.`,
    };
  }

  return null;
}
