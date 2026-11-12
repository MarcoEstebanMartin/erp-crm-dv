import prisma from '../../utils/prisma';
import { logAudit } from '../../utils/audit';
import { appCache } from '../../utils/cache';
import { doesLotMatchWmsScope } from '../../engines/stock.engine';
import {
  buildCanonicalSlotCode,
  validateCellMutationAgainstStock,
  type WarehouseChamberCode,
  type WarehouseDepId,
} from '../../engines/warehouse-layout.engine';

const WAREHOUSE_LAYOUT_CACHE_KEY = 'warehouse_cells_layout_v1';

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

    const saved = await prisma.$transaction(async (tx) => {
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

      return tx.warehouseCell.upsert({
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
    });

    appCache.del(WAREHOUSE_LAYOUT_CACHE_KEY);

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

    const deleted = await prisma.$transaction(async (tx) => {
      const existing = await tx.warehouseCell.findUnique({ where: { code: cleanCode } });
      if (!existing) return null;

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

      const targetState = fallbackBlueprint || { isStorage: false, levels: '' };
      const safety = validateCellMutationAgainstStock({
        cellCode: cleanCode,
        nextIsStorage: targetState.isStorage,
        nextLevels: targetState.levels,
        activeLotsInSlot,
      });

      if (!safety.allowed) {
        throw new Error(safety.reason || 'No se puede restaurar mientras tenga mercadería activa.');
      }

      return tx.warehouseCell.delete({ where: { code: cleanCode } });
    });

    appCache.del(WAREHOUSE_LAYOUT_CACHE_KEY);

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
