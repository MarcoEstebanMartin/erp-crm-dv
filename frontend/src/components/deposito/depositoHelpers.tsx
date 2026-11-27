import React from 'react';
import { DEPOSITO_SLOTS, SECTORS_INFO } from './depositomapaData';
import { extractSlotLevels } from './warehouseLayoutMerger';
import { formatWmsLocationCode, isSentinelExpiration } from '../stock/lotLabel';

export const playBeep = (type: 'success' | 'error') => {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'success') {
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } else {
      osc.frequency.setValueAtTime(220, ctx.currentTime);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    }
  } catch (e) {
    console.error('Audio context error:', e);
  }
};

export interface WmsSlotMeta {
  code: string;
  baseCode: string | null;
  level: string | null;
  chamber: string;
  sectorLabel: string;
  color: string;
  bg: string;
  description: string;
  weight: number;
  row: number;
  col: number;
}

const STRUCTURED_WMS_REGEX = /^(D\d+)[·.\-]R(\d{1,2})-C?(\d{1,2})(?:-?([A-F]))?$/;

const SECTOR_ROUTE_WEIGHT: Record<string, number> = {
  RACK_ENTRADA: 10,
  ESTANTERIA: 20,
  CAMARA_3: 30,
  CAMARA_2: 40,
  CAMARA_1: 50,
  D2_GENERAL: 60,
  D3_GENERAL: 70,
  GENERAL: 999,
};

const BASE_SLOT_BY_CODE = new Map(DEPOSITO_SLOTS.map((s) => [s.code.toUpperCase(), s]));

export const WMS_LOCATION_GROUPS: Array<{
  chamber: string;
  label: string;
  options: Array<{ value: string; label: string }>;
}> = (() => {
  const grouped = new Map<string, Array<{ value: string; label: string }>>();
  const orderedSlots = [...DEPOSITO_SLOTS].sort((a, b) => {
    const wA = SECTOR_ROUTE_WEIGHT[a.chamber] ?? 80;
    const wB = SECTOR_ROUTE_WEIGHT[b.chamber] ?? 80;
    if (wA !== wB) return wA - wB;
    if (a.row !== b.row) return a.row - b.row;
    return a.col - b.col;
  });

  for (const slot of orderedSlots) {
    const list = grouped.get(slot.chamber) || [];
    for (const lvl of extractSlotLevels(slot.nivel)) {
      const value = `${slot.code}-${lvl}`;
      list.push({ value, label: `${formatWmsLocationCode(value)} (${slot.deposito} · Nivel ${lvl})` });
    }
    grouped.set(slot.chamber, list);
  }

  return Array.from(grouped.entries()).map(([chamber, options]) => ({
    chamber,
    label: SECTORS_INFO[chamber]?.label || chamber,
    options,
  }));
})();

export const KNOWN_WMS_LOCATION_SET = new Set<string>(
  WMS_LOCATION_GROUPS.flatMap((g) => g.options.map((o) => o.value)),
);

function resolveLegacyChamber(cleanLoc: string): { chamber: string; weight: number } | null {
  if (cleanLoc.startsWith('D1-RKA') || cleanLoc.startsWith('D1-RKB') || cleanLoc.startsWith('D1-RACK')) {
    return { chamber: 'RACK_ENTRADA', weight: 10 };
  }
  if (cleanLoc.startsWith('D1-EST')) return { chamber: 'ESTANTERIA', weight: 20 };
  if (cleanLoc.startsWith('D1-CAM3')) return { chamber: 'CAMARA_3', weight: 30 };
  if (cleanLoc.startsWith('D1-CAM2')) return { chamber: 'CAMARA_2', weight: 40 };
  if (cleanLoc.startsWith('D1-CAM1')) return { chamber: 'CAMARA_1', weight: 50 };
  if (cleanLoc.startsWith('D2-')) return { chamber: 'D2_GENERAL', weight: 60 };
  if (cleanLoc.startsWith('D3-')) return { chamber: 'D3_GENERAL', weight: 70 };
  return null;
}

export function resolveWmsSlotMeta(locCode?: string | null): WmsSlotMeta {
  const cleanCode = typeof locCode === 'string' && locCode.trim() ? locCode.trim().toUpperCase() : 'S/U';
  if (cleanCode === 'S/U' || cleanCode === 'SIN-UBICAR') {
    return {
      code: 'S/U',
      baseCode: null,
      level: null,
      chamber: 'GENERAL',
      sectorLabel: 'Sin Ubicación',
      color: '#8E8E93',
      bg: 'rgba(142, 142, 147, 0.08)',
      description: 'Artículos sin ubicación física asignada',
      weight: 999,
      row: 999,
      col: 999,
    };
  }

  const structured = STRUCTURED_WMS_REGEX.exec(cleanCode);
  if (structured) {
    const [, dep, rowStr, colStr, level] = structured;
    const baseCode = `${dep}-R${rowStr.padStart(2, '0')}-C${colStr.padStart(2, '0')}`;
    const canonicalCode = level ? `${baseCode}-${level}` : baseCode;
    const baseSlot = BASE_SLOT_BY_CODE.get(baseCode);
    if (baseSlot) {
      const chamber = baseSlot.chamber || 'GENERAL';
      const sector = SECTORS_INFO[chamber] || SECTORS_INFO.GENERAL;
      const weight =
        SECTOR_ROUTE_WEIGHT[chamber] ??
        (baseSlot.dep_id === 'D2' ? 60 : baseSlot.dep_id === 'D3' ? 70 : 55);
      return {
        code: canonicalCode,
        baseCode,
        level: level || null,
        chamber,
        sectorLabel: sector.label,
        color: sector.color,
        bg: sector.bg,
        description: level ? `${baseSlot.deposito} · ${sector.label} · Nivel ${level}` : `${baseSlot.deposito} · ${sector.label}`,
        weight,
        row: baseSlot.row,
        col: baseSlot.col,
      };
    }

    const row = Number(rowStr);
    const col = Number(colStr);
    const chamber = canonicalCode.startsWith('D2-') ? 'D2_GENERAL' : canonicalCode.startsWith('D3-') ? 'D3_GENERAL' : 'GENERAL';
    const sector = SECTORS_INFO[chamber] || SECTORS_INFO.GENERAL;
    const weight = chamber === 'D2_GENERAL' ? 60 : chamber === 'D3_GENERAL' ? 70 : 55;
    return {
      code: canonicalCode,
      baseCode,
      level: level || null,
      chamber,
      sectorLabel: chamber === 'GENERAL' ? 'Depósito 1' : sector.label,
      color: sector.color,
      bg: sector.bg,
      description: level ? `${formatWmsLocationCode(baseCode)} · Nivel ${level}` : formatWmsLocationCode(baseCode),
      weight,
      row: Number.isFinite(row) ? row : 999,
      col: Number.isFinite(col) ? col : 999,
    };
  }

  const legacy = resolveLegacyChamber(cleanCode);
  if (legacy) {
    const sector = SECTORS_INFO[legacy.chamber] || SECTORS_INFO.GENERAL;
    return {
      code: cleanCode,
      baseCode: null,
      level: null,
      chamber: legacy.chamber,
      sectorLabel: sector.label,
      color: sector.color,
      bg: sector.bg,
      description: sector.label,
      weight: legacy.weight,
      row: 0,
      col: 0,
    };
  }

  return {
    code: cleanCode,
    baseCode: null,
    level: null,
    chamber: 'GENERAL',
    sectorLabel: cleanCode,
    color: '#8E8E93',
    bg: 'var(--bg-secondary)',
    description: cleanCode,
    weight: 100,
    row: 999,
    col: 999,
  };
}

function isLotExpiredUtc(exp?: string | Date | null): boolean {
  if (!exp || isSentinelExpiration(exp)) return false;
  const parsed = exp instanceof Date ? exp : new Date(exp);
  if (Number.isNaN(parsed.getTime())) return false;
  const now = new Date();
  return (
    Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate()) <=
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );
}

export const getProductLocation = (product: any): string => {
  const lots: any[] = Array.isArray(product?.lots) ? product.lots : [];
  const locatedPositive = lots
    .filter((l) => Number(l?.stock || 0) > 0 && l?.location && String(l.location).trim().toUpperCase() !== 'S/U')
    .sort((a, b) => {
      const expA = a.expirationDate ? new Date(a.expirationDate).getTime() : Number.MAX_SAFE_INTEGER;
      const expB = b.expirationDate ? new Date(b.expirationDate).getTime() : Number.MAX_SAFE_INTEGER;
      return expA - expB || Number(a.id || 0) - Number(b.id || 0);
    });

  const validLot = locatedPositive.find((l) => !isLotExpiredUtc(l.expirationDate));
  if (validLot?.location) return String(validLot.location).trim().toUpperCase();
  if (locatedPositive[0]?.location) return String(locatedPositive[0].location).trim().toUpperCase();
  if (product?.defaultLocation && String(product.defaultLocation).trim()) {
    return String(product.defaultLocation).trim().toUpperCase();
  }
  return 'S/U';
};

export const renderLocationTag = (locCode: string) => {
  const meta = resolveWmsSlotMeta(locCode);
  return (
    <span
      className="badge"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        fontSize: '0.8rem',
        fontWeight: 600,
        backgroundColor: meta.bg,
        color: meta.color,
        border: `1px solid ${meta.color}30`,
        padding: '3px 8px',
        borderRadius: '4px',
        fontFamily: 'monospace',
      }}
      title={meta.description}
    >
      {meta.code === 'S/U' ? 'Sin ubicar' : formatWmsLocationCode(meta.code)}
    </span>
  );
};

export const getLocationWeight = (loc: string): number => resolveWmsSlotMeta(loc).weight;

export const sortItemsByOptimalRoute = (items: any[]) => {
  return [...items].sort((a, b) => {
    const locA = getProductLocation(a.product || a);
    const locB = getProductLocation(b.product || b);
    const metaA = resolveWmsSlotMeta(locA);
    const metaB = resolveWmsSlotMeta(locB);
    if (metaA.weight !== metaB.weight) return metaA.weight - metaB.weight;
    if (metaA.row !== metaB.row) return metaA.row - metaB.row;
    if (metaA.col !== metaB.col) return metaA.col - metaB.col;
    return metaA.code.localeCompare(metaB.code);
  });
};

/**
 * Detector Automático de "Coma Faltante" (Spec 003 / OrderEngine.normalizeScaleWeight)
 * Detecta cuando un operario tipea gramos (4250) o le falta la coma (42.5) en vez de kilos (4.250 kg).
 */
export function detectWeightAnomaly(
  inputWeight: number,
  quantity: number,
  approxWeightKg?: number | null,
): {
  isAnomaly: boolean;
  expectedKg: number;
  suggestedKg: number | null;
} {
  if (!inputWeight || inputWeight <= 0) {
    return { isAnomaly: false, expectedKg: 0, suggestedKg: null };
  }
  const unitApprox = Number(approxWeightKg) > 0 ? Number(approxWeightKg) : 4.0;
  const expectedKg = Number((Math.max(1, quantity) * unitApprox).toFixed(3));

  if (inputWeight >= 100) {
    const div1000 = Number((inputWeight / 1000).toFixed(3));
    return {
      isAnomaly: true,
      expectedKg,
      suggestedKg: div1000 > 0 ? div1000 : null,
    };
  }

  if (inputWeight > expectedKg * 2.2) {
    const div10 = Number((inputWeight / 10).toFixed(3));
    const div100 = Number((inputWeight / 100).toFixed(3));
    let suggestedKg: number | null = null;
    if (div10 >= expectedKg * 0.4 && div10 <= expectedKg * 1.8) suggestedKg = div10;
    else if (div100 >= expectedKg * 0.4 && div100 <= expectedKg * 1.8) suggestedKg = div100;
    return {
      isAnomaly: true,
      expectedKg,
      suggestedKg,
    };
  }

  return { isAnomaly: false, expectedKg, suggestedKg: null };
}
