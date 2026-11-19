import prisma from '../../utils/prisma';
import { logAudit } from '../../utils/audit';
import { appCache } from '../../utils/cache';
import {
  doesLotMatchWmsScope,
  normalizeWmsLocationCode,
} from '../../engines/stock.engine';
import {
  buildCanonicalSlotCode,
  validateCellMutationAgainstStock,
  validateSlotAllowsStockAssignment,
  validateStorageChamberRule,
  type WarehouseChamberCode,
  type WarehouseDepId,
} from '../../engines/warehouse-layout.engine';
import { getBaseWarehouseCell } from '../../utils/warehouse-base-layout.util';

const WAREHOUSE_LAYOUT_CACHE_KEY = 'warehouse_cells_layout_v1';

async function clearOrphanedDefaultLocationsInTx(
  tx: any,
  slotCode: string,
  targetRule: { isStorage: boolean; levels: string },
): Promise<number> {
  if (typeof tx?.product?.findMany !== 'function' || typeof tx?.product?.update !== 'function') {
    return 0;
  }

  const products = await tx.product.findMany({
    where: {
      OR: [
        { defaultLocation: slotCode },
        { defaultLocation: { startsWith: `${slotCode}-` } },
      ],
    },
    select: { id: true, defaultLocation: true },
  });

  let clearedCount = 0;
  for (const prod of products || []) {
    const normDefault = normalizeWmsLocationCode(prod.defaultLocation);
    if (!doesLotMatchWmsScope(normDefault, slotCode)) continue;
    const stillAllowed =
      targetRule.isStorage &&
      validateSlotAllowsStockAssignment(
        {
          code: slotCode,
          isStorage: targetRule.isStorage,
          isBlocked: false,
          levels: targetRule.levels,
        },
        normDefault,
      ).allowed;

    if (!stillAllowed) {
      await tx.product.update({
        where: { id: prod.id },
        data: { defaultLocation: null },
      });
      clearedCount += 1;
    }
  }
  return clearedCount;
}

export interface UpsertWarehouseCellInput {
  depId: WarehouseDepId;
  row: number;
  col: number;
  isStorage: boolean;
  levels?: string;
  chamber?: WarehouseChamberCode;
  label?: string | null;
  fill?: string | null;
  isBlocked?: boolean;
  maxUnits?: number | null;
}

export class WarehouseLayoutService {
  async getCells() {
    const cached = appCache.get<any[]>(WAREHOUSE_LAYOUT_CACHE_KEY);
    if (cached) return cached;

    const cells = await prisma.warehouseCell.findMany({
      orderBy: [{ row: 'asc' }, { col: 'asc' }],
    });

    appCache.set(WAREHOUSE_LAYOUT_CACHE_KEY, cells, 300);
    return cells;
  }

  async upsertCell(input: UpsertWarehouseCellInput, userId: number) {
    const row = Math.trunc(Number(input.row));
    const col = Math.trunc(Number(input.col));
    const code = buildCanonicalSlotCode(input.depId, row, col);
    const nextLevels = input.isStorage
      ? (input.levels || 'A').trim().toUpperCase()
      : (input.levels || '').trim();
    const nextChamber = input.chamber || 'GENERAL';
    const nextLabel = input.label && input.label.trim() ? input.label.trim() : null;
    const nextFill = input.fill && input.fill.trim() ? input.fill.trim() : null;
    const nextBlocked = input.isStorage ? Boolean(input.isBlocked) : false;
    const nextMaxUnits =
      input.isStorage && input.maxUnits && Number(input.maxUnits) > 0
        ? Math.trunc(Number(input.maxUnits))
        : null;

    const chamberCheck = validateStorageChamberRule(input.isStorage, nextChamber);
    if (!chamberCheck.allowed) {
      throw new Error(chamberCheck.reason || 'Sector inválido para almacenamiento.');
    }

    const { saved, clearedDefaults } = await prisma.$transaction(async (tx) => {
      const candidateLots = await tx.productLot.findMany({
        where: {
          stock: { gt: 0 },
          OR: [{ location: code }, { location: { startsWith: `${code}-` } }],
        },
        select: { lotNumber: true, stock: true, location: true },
      });

      const activeLotsInSlot = candidateLots.filter((l) =>
        doesLotMatchWmsScope(l.location, code),
      );

      const safety = validateCellMutationAgainstStock({
        cellCode: code,
        nextIsStorage: input.isStorage,
        nextLevels,
        activeLotsInSlot,
      });

      if (!safety.allowed) {
        throw new Error(safety.reason || 'Operación bloqueada por mercadería activa en el slot.');
      }

      const upserted = await tx.warehouseCell.upsert({
        where: { code },
        update: {
          depId: input.depId,
          row,
          col,
          isStorage: input.isStorage,
          levels: nextLevels,
          chamber: nextChamber,
          label: nextLabel,
          fill: nextFill,
          isBlocked: nextBlocked,
          maxUnits: nextMaxUnits,
          updatedById: userId,
        },
        create: {
          code,
          depId: input.depId,
          row,
          col,
          isStorage: input.isStorage,
          levels: nextLevels,
          chamber: nextChamber,
          label: nextLabel,
          fill: nextFill,
          isBlocked: nextBlocked,
          maxUnits: nextMaxUnits,
          updatedById: userId,
        },
      });

      const clearedCount = await clearOrphanedDefaultLocationsInTx(tx, code, {
        isStorage: input.isStorage,
        levels: nextLevels,
      });

      return { saved: upserted, clearedDefaults: clearedCount };
    });

    appCache.del(WAREHOUSE_LAYOUT_CACHE_KEY);
    if (clearedDefaults > 0) {
      appCache.invalidateProductCatalog();
    }

    await logAudit({
      userId,
      action: 'UPSERT_WAREHOUSE_CELL',
      entityType: 'WarehouseCell',
      entityId: saved.id,
      newValues: {
        code: saved.code,
        isStorage: saved.isStorage,
        levels: saved.levels,
        chamber: saved.chamber,
        label: saved.label,
        isBlocked: saved.isBlocked,
      },
    });

    return saved;
  }

  async deleteCellOverride(
    code: string,
    userId: number,
    fallbackBlueprint?: { isStorage: boolean; levels: string },
  ) {
    const cleanCode = code.trim().toUpperCase();

    const { deleted, clearedDefaults } = await prisma.$transaction(async (tx) => {
      const existing = await tx.warehouseCell.findUnique({ where: { code: cleanCode } });
      if (!existing) return { deleted: null, clearedDefaults: 0 };

      const candidateLots = await tx.productLot.findMany({
        where: {
          stock: { gt: 0 },
          OR: [{ location: cleanCode }, { location: { startsWith: `${cleanCode}-` } }],
        },
        select: { lotNumber: true, stock: true, location: true },
      });

      const activeLotsInSlot = candidateLots.filter((l) =>
        doesLotMatchWmsScope(l.location, cleanCode),
      );

      const baseCell = getBaseWarehouseCell(cleanCode);
      const targetState = baseCell
        ? { isStorage: baseCell.isStorage, levels: baseCell.levels }
        : fallbackBlueprint || { isStorage: false, levels: '' };
      const safety = validateCellMutationAgainstStock({
        cellCode: cleanCode,
        nextIsStorage: targetState.isStorage,
        nextLevels: targetState.levels,
        activeLotsInSlot,
      });

      if (!safety.allowed) {
        throw new Error(safety.reason || 'No se puede restaurar mientras tenga mercadería activa.');
      }

      const deletedRow = await tx.warehouseCell.delete({ where: { code: cleanCode } });
      const clearedCount = await clearOrphanedDefaultLocationsInTx(tx, cleanCode, targetState);
      return { deleted: deletedRow, clearedDefaults: clearedCount };
    });

    appCache.del(WAREHOUSE_LAYOUT_CACHE_KEY);
    if (clearedDefaults > 0) {
      appCache.invalidateProductCatalog();
    }

    if (deleted) {
      await logAudit({
        userId,
        action: 'RESET_WAREHOUSE_CELL',
        entityType: 'WarehouseCell',
        entityId: deleted.id,
        oldValues: { code: cleanCode },
        newValues: {},
      });
    }

    return { restoredCode: cleanCode, hadCustomRow: Boolean(deleted) };
  }
}

export const warehouseLayoutService = new WarehouseLayoutService();
