import { normalizeWmsLocationCode, parseWmsLocationScope } from './stock.engine';

export const VALID_WAREHOUSE_IDS = ['D1', 'D2', 'D3'] as const;
export type WarehouseDepId = (typeof VALID_WAREHOUSE_IDS)[number];

const SLOT_LIKE_REGEX = /^(D\d+-R\d{2}-C\d{2})(?:-(.+))?$/;
const FORBIDDEN_LOCATION_TOKENS = new Set(['BANO', 'BAÑO', 'PASILLO', 'SANITARIOS']);

export const VALID_LEVEL_PRESETS = ['A', 'A-B', 'A-B-C', 'A-B-C-D', 'A-B-C-D-E-F'] as const;
export type WarehouseLevelPreset = (typeof VALID_LEVEL_PRESETS)[number];

export const VALID_CHAMBER_CODES = [
  'ESTANTERIA',
  'RACK_ENTRADA',
  'CAMARA_1',
  'CAMARA_2',
  'CAMARA_3',
  'BANO',
  'D2_GENERAL',
  'D3_GENERAL',
  'GENERAL',
] as const;
export type WarehouseChamberCode = (typeof VALID_CHAMBER_CODES)[number];

export interface ActiveSlotLotRef {
  lotNumber: string;
  stock: number;
  location: string | null;
}

export interface WarehouseCellRuleTarget {
  code: string;
  isStorage: boolean;
  isBlocked: boolean;
  levels: string;
}

/**
 * Construye el código canónico de celda WMS (ej. D1 + fila 1 + col 4 -> "D1-R01-C04").
 */
export function buildCanonicalSlotCode(depId: string, row: number, col: number): string {
  const cleanDep = String(depId || 'D1').trim().toUpperCase();
  const r = Math.max(1, Math.trunc(Number(row)));
  const c = Math.max(1, Math.trunc(Number(col)));
  return `${cleanDep}-R${r.toString().padStart(2, '0')}-C${c.toString().padStart(2, '0')}`;
}

/**
 * Devuelve la lista de pisos/niveles habilitados (ej. "A-B-C" -> ["A", "B", "C"]).
 */
export function extractSupportedLevels(levelsStr: string | null | undefined): string[] {
  if (!levelsStr || typeof levelsStr !== 'string') return ['A'];
  const parsed = levelsStr
    .toUpperCase()
    .split('-')
    .map((p) => p.trim())
    .filter((p) => /^[A-F]$/.test(p));
  return parsed.length > 0 ? Array.from(new Set(parsed)) : ['A'];
}

/**
 * Verifica que una modificación estructural de un Slot NO deje mercadería huérfana:
 * - Prohibido convertir en pasillo si tiene unidades ubicadas.
 * - Prohibido eliminar un piso superior (ej. bajar de A-B-C a A) si ese piso tiene unidades ubicadas.
 */
export function validateCellMutationAgainstStock(params: {
  cellCode: string;
  nextIsStorage: boolean;
  nextLevels: string;
  activeLotsInSlot: ActiveSlotLotRef[];
}): { allowed: boolean; reason?: string } {
  const occupied = params.activeLotsInSlot.filter((l) => l.stock > 0);
  const totalUnits = occupied.reduce((sum, l) => sum + l.stock, 0);

  if (totalUnits === 0) {
    return { allowed: true };
  }

  if (!params.nextIsStorage) {
    return {
      allowed: false,
      reason: `No se puede convertir el Slot ${params.cellCode} en pasillo porque todavía tiene ${totalUnits} u. ubicadas. Primero liberá su mercadería a Sin Ubicar (S/U).`,
    };
  }

  const nextSupported = new Set(extractSupportedLevels(params.nextLevels));
  for (const lot of occupied) {
    const scope = parseWmsLocationScope(lot.location || params.cellCode);
    const currentLevel = scope.level || 'A';
    if (!nextSupported.has(currentLevel)) {
      return {
        allowed: false,
        reason: `No se puede quitar el Piso/Nivel ${currentLevel} del Slot ${params.cellCode} porque tiene ${lot.stock} u. ubicadas en ${lot.location || params.cellCode}. Movelas a otro piso o liberalas a S/U primero.`,
      };
    }
  }

  return { allowed: true };
}

/**
 * Verifica que una celda permita ubicar mercadería antes de ejecutar `assignWmsLocation`.
 */
export function validateSlotAllowsStockAssignment(
  cell: WarehouseCellRuleTarget | null,
  requestedLocationCode: string,
): { allowed: boolean; reason?: string } {
  if (!cell) {
    return { allowed: true };
  }

  if (!cell.isStorage) {
    return {
      allowed: false,
      reason: `La celda ${cell.code} está configurada como Pasillo/Circulación y no admite mercadería.`,
    };
  }

  if (cell.isBlocked) {
    return {
      allowed: false,
      reason: `El Slot ${cell.code} está bloqueado temporalmente por mantenimiento y no admite cargas.`,
    };
  }

  const scope = parseWmsLocationScope(requestedLocationCode);
  const requestedLevel = scope.level || 'A';
  const supported = extractSupportedLevels(cell.levels);
  if (!supported.includes(requestedLevel)) {
    return {
      allowed: false,
      reason: `El Slot ${cell.code} solo tiene habilitados los pisos ${supported.join(', ')} (solicitado: Nivel ${requestedLevel}).`,
    };
  }

  return { allowed: true };
}

/**
 * Valida formato básico de ubicación WMS y bloquea tokens prohibidos o niveles fuera de A–F.
 */
export function validateRequestedWmsLocationFormat(requestedLocationCode: string): {
  allowed: boolean;
  reason?: string;
  baseSlotCode?: string;
  isSlotLike: boolean;
} {
  const clean = normalizeWmsLocationCode(requestedLocationCode);
  if (!clean || clean === 'S/U') {
    return { allowed: true, isSlotLike: false };
  }

  if (FORBIDDEN_LOCATION_TOKENS.has(clean)) {
    return {
      allowed: false,
      isSlotLike: false,
      reason: `La ubicación "${clean}" corresponde a un sector no habilitado para mercadería.`,
    };
  }

  const match = SLOT_LIKE_REGEX.exec(clean);
  if (!match) {
    return { allowed: true, isSlotLike: false };
  }

  const baseSlotCode = match[1];
  const levelSuffix = match[2];
  if (levelSuffix !== undefined && !/^[A-F]$/.test(levelSuffix)) {
    return {
      allowed: false,
      isSlotLike: true,
      baseSlotCode,
      reason: `El nivel "${levelSuffix}" en ${clean} no es válido. Los niveles permitidos son A a F.`,
    };
  }

  return { allowed: true, isSlotLike: true, baseSlotCode };
}

/**
 * Impide configurar un slot de almacenamiento dentro del sector Baño / Sanitarios.
 */
export function validateStorageChamberRule(
  isStorage: boolean,
  chamber?: string,
): { allowed: boolean; reason?: string } {
  if (isStorage && chamber === 'BANO') {
    return {
      allowed: false,
      reason: 'No se puede configurar un slot de mercadería en el sector Baño / Sanitarios.',
    };
  }
  return { allowed: true };
}
