import { DEPOSITO_MATRIX } from './depositomapaData';
import type { DepositSlot, SlotCellData } from './depositomapaData';

export interface WarehouseCellOverride {
  id: number;
  code: string;
  depId: string;
  row: number;
  col: number;
  isStorage: boolean;
  levels: string;
  chamber: string;
  label?: string | null;
  fill?: string | null;
  isBlocked: boolean;
  maxUnits?: number | null;
}

export interface MergedSlotCellData extends SlotCellData {
  code: string;
  isBlocked: boolean;
  customLabel: string | null;
  hasOverride: boolean;
  maxUnits: number | null;
}

export interface MergedDepositSlot extends DepositSlot {
  isBlocked?: boolean;
  customLabel?: string | null;
  hasOverride?: boolean;
  maxUnits?: number | null;
}

export function buildCellCode(depId: string, row: number, col: number): string {
  return `${depId.toUpperCase()}-R${row.toString().padStart(2, '0')}-C${col.toString().padStart(2, '0')}`;
}

export function extractBaseSlotFromLocation(location?: string | null): string | null {
  if (!location || location === 'S/U') return null;
  return location.trim().toUpperCase().split('-').slice(0, 3).join('-');
}

export function extractSlotLevels(levelsStr?: string | null): ('A' | 'B' | 'C' | 'D' | 'E' | 'F')[] {
  if (!levelsStr) return ['A'];
  const parsed = levelsStr
    .toUpperCase()
    .split('-')
    .map((p) => p.trim())
    .filter((p): p is 'A' | 'B' | 'C' | 'D' | 'E' | 'F' => /^[A-F]$/.test(p));
  return parsed.length > 0 ? Array.from(new Set(parsed)) : ['A'];
}

function getWarehouseLabel(depId: string): string {
  if (depId === 'D1') return 'Depósito 1';
  if (depId === 'D2') return 'Depósito 2';
  if (depId === 'D3') return 'Depósito 3';
  return depId;
}

export function mergeWarehouseLayout(customCells: WarehouseCellOverride[] = []) {
  const overrideByCode = new Map<string, WarehouseCellOverride>();
  for (const c of customCells || []) {
    if (c?.code) overrideByCode.set(c.code.toUpperCase(), c);
  }

  const originalCellByCode: Record<string, { isStorage: boolean; levels: string }> = {};
  const mergedSlots: MergedDepositSlot[] = [];

  const mergedMatrix: MergedSlotCellData[][] = DEPOSITO_MATRIX.map((row) =>
    row.map((baseCell) => {
      const code = buildCellCode(baseCell.dep_id, baseCell.r, baseCell.c);
      originalCellByCode[code] = {
        isStorage: Boolean(baseCell.is_storage),
        levels: baseCell.is_storage ? baseCell.val || 'A' : '',
      };

      const ov = overrideByCode.get(code);
      if (!ov) {
        const cellData: MergedSlotCellData = {
          ...baseCell,
          code,
          isBlocked: false,
          customLabel: null,
          hasOverride: false,
          maxUnits: null,
        };
        if (cellData.is_storage) {
          mergedSlots.push({
            code,
            dep_id: cellData.dep_id,
            deposito: getWarehouseLabel(cellData.dep_id),
            row: cellData.r,
            col: cellData.c,
            nivel: cellData.val || 'A',
            fill: cellData.fill,
            chamber: cellData.chamber,
            isBlocked: false,
            customLabel: null,
            hasOverride: false,
            maxUnits: null,
          });
        }
        return cellData;
      }

      const isStorage = Boolean(ov.isStorage);
      const displayVal = isStorage ? ov.levels || 'A' : ov.label || '';
      const resolvedFill = ov.fill || (isStorage ? baseCell.fill || '#FFFFFF' : '#FFFFFF');
      const resolvedChamber = ov.chamber || (isStorage ? baseCell.chamber || 'ESTANTERIA' : 'GENERAL');

      const mergedCell: MergedSlotCellData = {
        r: baseCell.r,
        c: baseCell.c,
        dep_id: ov.depId || baseCell.dep_id,
        is_storage: isStorage,
        val: displayVal,
        fill: resolvedFill,
        chamber: resolvedChamber,
        code,
        isBlocked: isStorage ? Boolean(ov.isBlocked) : false,
        customLabel: ov.label || null,
        hasOverride: true,
        maxUnits: ov.maxUnits ?? null,
      };

      if (isStorage) {
        mergedSlots.push({
          code,
          dep_id: mergedCell.dep_id,
          deposito: getWarehouseLabel(mergedCell.dep_id),
          row: mergedCell.r,
          col: mergedCell.c,
          nivel: ov.levels || 'A',
          fill: resolvedFill,
          chamber: resolvedChamber,
          isBlocked: mergedCell.isBlocked,
          customLabel: mergedCell.customLabel,
          hasOverride: true,
          maxUnits: mergedCell.maxUnits,
        });
      }

      return mergedCell;
    }),
  );

  return {
    mergedMatrix,
    mergedSlots,
    originalCellByCode,
    activeSlotsCount: mergedSlots.length,
  };
}
