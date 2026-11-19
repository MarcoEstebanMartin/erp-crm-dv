import fs from 'fs';
import path from 'path';
import { normalizeWmsLocationCode } from '../engines/stock.engine';
import {
  buildCanonicalSlotCode,
  validateRequestedWmsLocationFormat,
  validateSlotAllowsStockAssignment,
  type WarehouseCellRuleTarget,
} from '../engines/warehouse-layout.engine';

export interface BaseWarehouseCellRule extends WarehouseCellRuleTarget {
  depId: string;
  row: number;
  col: number;
  chamber: string;
  label: string | null;
}

interface RawMatrixCell {
  r: number;
  c: number;
  val?: string;
  is_storage?: boolean;
  dep_id?: string;
  chamber?: string;
}

let cachedBaseMap: Map<string, BaseWarehouseCellRule> | null = null;

function resolveBlueprintPath(): string | null {
  const candidates = [
    path.resolve(__dirname, '../../prisma/data/deposito-mapa.json'),
    path.resolve(process.cwd(), 'prisma/data/deposito-mapa.json'),
    path.resolve(process.cwd(), 'backend/prisma/data/deposito-mapa.json'),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

function loadBaseWarehouseMap(): Map<string, BaseWarehouseCellRule> {
  if (cachedBaseMap) return cachedBaseMap;
  const map = new Map<string, BaseWarehouseCellRule>();
  const filePath = resolveBlueprintPath();
  if (!filePath) {
    cachedBaseMap = map;
    return map;
  }

  const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as {
    matrix?: RawMatrixCell[][];
  };

  for (const row of raw.matrix || []) {
    for (const cell of row || []) {
      const depId = String(cell.dep_id || 'D1').trim().toUpperCase();
      const r = Number(cell.r);
      const c = Number(cell.c);
      if (!Number.isFinite(r) || !Number.isFinite(c)) continue;
      const code = buildCanonicalSlotCode(depId, r, c);
      const isStorage = Boolean(cell.is_storage);
      map.set(code, {
        code,
        depId,
        row: r,
        col: c,
        isStorage,
        isBlocked: false,
        levels: isStorage ? String(cell.val || 'A').trim().toUpperCase() : '',
        chamber: String(cell.chamber || 'GENERAL').trim().toUpperCase(),
        label: !isStorage && cell.val ? String(cell.val).trim() : null,
      });
    }
  }

  cachedBaseMap = map;
  return map;
}

/**
 * Devuelve la regla del plano base (`deposito-mapa.json`) para un código de slot canónico (ej. D1-R01-C04).
 */
export function getBaseWarehouseCell(code: string): BaseWarehouseCellRule | null {
  const clean = String(code || '').trim().toUpperCase();
  if (!clean) return null;
  return loadBaseWarehouseMap().get(clean) || null;
}

/**
 * Valida en transacción si una ubicación destino admite ingreso de stock físico:
 * 1) `S/U` siempre es válida.
 * 2) Rechaza tokens prohibidos (`BANO`, `PASILLO`, etc.) y niveles inválidos fuera de `A–F`.
 * 3) Consulta override en DB (`WarehouseCell`); si no existe, aplica el plano base (`deposito-mapa.json`).
 */
export async function assertSlotAcceptsStockInTx(
  tx: any,
  rawLocation: string | null | undefined,
): Promise<void> {
  const cleanLoc = normalizeWmsLocationCode(rawLocation);
  if (cleanLoc === 'S/U') return;

  const fmt = validateRequestedWmsLocationFormat(cleanLoc);
  if (!fmt.allowed) {
    throw new Error(fmt.reason || 'Ubicación WMS inválida.');
  }
  if (!fmt.isSlotLike || !fmt.baseSlotCode) {
    return;
  }

  const customCell =
    typeof tx?.warehouseCell?.findUnique === 'function'
      ? await tx.warehouseCell.findUnique({ where: { code: fmt.baseSlotCode } })
      : null;

  if (customCell) {
    const check = validateSlotAllowsStockAssignment(customCell, cleanLoc);
    if (!check.allowed) {
      throw new Error(check.reason || 'El slot seleccionado no admite mercadería.');
    }
    return;
  }

  const baseCell = getBaseWarehouseCell(fmt.baseSlotCode);
  if (!baseCell) {
    throw new Error(`La ubicación ${fmt.baseSlotCode} no existe en el plano del depósito.`);
  }

  const check = validateSlotAllowsStockAssignment(baseCell, cleanLoc);
  if (!check.allowed) {
    throw new Error(check.reason || 'El slot seleccionado no admite mercadería.');
  }
}
