import { MovementType, Prisma } from '@prisma/client';
import prisma from '../../utils/prisma';
import { logAudit } from '../../utils/audit';
import { lockProductsForUpdate } from '../../utils/db-locks.util';
import {
  AtomicStockAdjustmentItem,
  StockAdjustMode,
  executeAtomicStockAdjustmentsInTx,
} from './product-stock-tx.helper';

export interface StockAdjustmentItemInput {
  productId: number;
  quantityChange?: number;
  targetStock?: number;
  mode?: StockAdjustMode;
  reason?: string;
  lotNumber?: string;
  expirationDate?: string;
  location?: string | null;
  lotId?: number | null;
}

export interface StockMovementsFilterOptions {
  limit?: number;
  beforeId?: number;
  type?: MovementType;
  startDate?: string;
  endDate?: string;
}

const MOVEMENT_RELATIONS_INCLUDE = {
  user: { select: { id: true, username: true, role: true } },
  productLot: true,
  order: {
    select: {
      id: true,
      movementId: true,
      invoiceNumber: true,
      status: true,
      persona: { select: { id: true, name: true } },
    },
  },
  purchaseOrder: {
    select: { id: true, status: true, persona: { select: { id: true, name: true } } },
  },
  creditNote: {
    select: { id: true, movementId: true, creditNoteNumber: true, reason: true },
  },
} as const;

export class ProductStockSubService {
  /**
   * Ajustar stock físicamente con bloqueo de fila (`FOR UPDATE`) e invariante estricta:
   * `Product.stock = Math.max(0, Σlotes - reservas)`.
   * Soporta `quantityChange` (DELTA), `targetStock` (conteo absoluto) y `mode: 'VACATE_LOT'`.
   */
  async adjustStock(id: number, data: Omit<AtomicStockAdjustmentItem, 'productId'>, userId: number) {
    const outcome = await prisma.$transaction(async (tx) => {
      await lockProductsForUpdate(tx, [id]);
      const [single] = await executeAtomicStockAdjustmentsInTx(
        tx,
        [{ ...data, productId: id }],
        userId,
        'Ajuste de stock manual',
      );
      return single;
    });

    await logAudit({
      userId,
      action: 'ADJUST_STOCK',
      entityType: 'Product',
      entityId: id,
      oldValues: { stock: outcome.previousStock, physicalUnits: outcome.previousPhysical },
      newValues: {
        stock: outcome.newStock,
        physicalUnits: outcome.newPhysical,
        reservedQty: outcome.reservedQty,
        appliedDelta: outcome.appliedDelta,
        movementId: outcome.movement?.id ?? null,
        lotNumber: data?.lotNumber,
        mode: data?.mode || (data?.targetStock !== undefined ? 'TARGET_STOCK' : 'DELTA'),
      },
    });

    const freshProduct = await prisma.product.findUnique({
      where: { id },
      include: { lots: { orderBy: { expirationDate: 'asc' } } },
    });

    return { product: freshProduct, movement: outcome.movement };
  }

  /**
   * Ajuste masivo atómico (Modo Inventario Rápido) en 1 sola transacción libre de deadlocks.
   * Ejecuta sobre el mismo motor transaccional que `adjustStock` bajo `FOR UPDATE`.
   */
  async adjustStockBatch(items: StockAdjustmentItemInput[], userId: number) {
    if (!Array.isArray(items) || items.length === 0) {
      throw new Error('No se enviaron ajustes de stock para procesar.');
    }

    const orderedItems = [...items].sort((a, b) => a.productId - b.productId);
    const outcomes = await prisma.$transaction(
      async (tx) => {
        const uniqueProductIds = Array.from(new Set(orderedItems.map((i) => i.productId)));
        await lockProductsForUpdate(tx, uniqueProductIds);
        return executeAtomicStockAdjustmentsInTx(
          tx,
          orderedItems,
          userId,
          'Ajuste rápido de inventario',
        );
      },
      { maxWait: 10000, timeout: 30000 },
    );

    const adjustments = outcomes.map((o) => ({
      productId: o.productId,
      previousStock: o.previousStock,
      newStock: o.newStock,
      previousPhysical: o.previousPhysical,
      newPhysical: o.newPhysical,
      reservedQty: o.reservedQty,
      movementId: o.movement?.id ?? 0,
      appliedDelta: o.appliedDelta,
    }));

    await logAudit({
      userId,
      action: 'ADJUST_STOCK_BATCH',
      entityType: 'Product',
      entityId: 0,
      newValues: { count: adjustments.length, adjustments },
    });

    return { appliedCount: adjustments.length, adjustments };
  }

  async getProductMovements(productId: number, options?: StockMovementsFilterOptions) {
    const safeLimit = Math.min(Math.max(Math.trunc(Number(options?.limit || 120)), 1), 500);
    const where: Prisma.StockMovementWhereInput = { productId };

    if (options?.beforeId && Number.isInteger(options.beforeId) && options.beforeId > 0) {
      where.id = { lt: options.beforeId };
    }
    if (options?.type && ['IN', 'OUT', 'ADJUSTMENT'].includes(options.type)) {
      where.type = options.type;
    }
    if (options?.startDate || options?.endDate) {
      where.createdAt = {
        ...(options.startDate ? { gte: new Date(options.startDate) } : {}),
        ...(options.endDate ? { lte: new Date(options.endDate) } : {}),
      };
    }

    return prisma.stockMovement.findMany({
      where,
      take: safeLimit,
      include: MOVEMENT_RELATIONS_INCLUDE,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
  }

  async getGlobalStockMovements(options?: StockMovementsFilterOptions) {
    const safeLimit = Math.min(Math.max(Math.trunc(Number(options?.limit || 80)), 1), 300);
    const where: Prisma.StockMovementWhereInput = {};

    if (options?.beforeId && Number.isInteger(options.beforeId) && options.beforeId > 0) {
      where.id = { lt: options.beforeId };
    }
    if (options?.type && ['IN', 'OUT', 'ADJUSTMENT'].includes(options.type)) {
      where.type = options.type;
    }

    return prisma.stockMovement.findMany({
      where,
      take: safeLimit,
      include: {
        product: { select: { id: true, sku: true, name: true } },
        ...MOVEMENT_RELATIONS_INCLUDE,
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
  }

  async getExpiringLots() {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + 30);

    return prisma.productLot.findMany({
      where: { stock: { gt: 0 }, expirationDate: { lte: targetDate } },
      include: { product: { select: { id: true, sku: true, name: true, barcode: true } } },
      orderBy: { expirationDate: 'asc' },
    });
  }
}

export const productStockSubService = new ProductStockSubService();
