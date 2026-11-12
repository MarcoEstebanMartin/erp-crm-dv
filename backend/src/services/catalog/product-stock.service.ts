import { MovementType, Prisma } from '@prisma/client';
import prisma from '../../utils/prisma';
import { logAudit } from '../../utils/audit';
import { lockProductsForUpdate } from '../../utils/db-locks.util';
import { normalizeWmsLocationCode } from '../../engines/stock.engine';

export interface StockAdjustmentItemInput {
  productId: number;
  quantityChange: number;
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
  private async applySingleAdjustmentInTx(
    tx: Prisma.TransactionClient,
    id: number,
    data: any,
    userId: number,
  ) {
    const { quantityChange, reason, lotNumber, expirationDate, location, lotId: inputLotId } = data;
    const change = Math.trunc(Number(quantityChange));
    if (!Number.isFinite(change) || change === 0) {
      throw new Error('El ajuste de stock debe ser un número entero distinto de cero.');
    }
    const cleanLoc = normalizeWmsLocationCode(location);

    const product = await tx.product.findUnique({ where: { id } });
    if (!product) throw new Error(`Producto #${id} no encontrado.`);
    if (change < 0 && product.stock <= 0) {
      throw new Error(
        `El producto "${product.name || id}" ya tiene stock en 0; no hay unidades para descontar.`,
      );
    }

    let lot: any = null;
    if (inputLotId) {
      lot = await tx.productLot.findUnique({ where: { id: Number(inputLotId) } });
      if (lot && lot.productId !== product.id) {
        throw new Error('El lote indicado no pertenece al producto seleccionado.');
      }
    }

    let rawLotNum =
      lotNumber && typeof lotNumber === 'string' && lotNumber.trim() ? lotNumber.trim() : '';

    if (!lot) {
      if (!rawLotNum || rawLotNum.toUpperCase() === 'S/L') {
        rawLotNum = cleanLoc !== 'S/U' ? `S/L-${cleanLoc}` : 'S/L';
      }
      lot = await tx.productLot.findUnique({
        where: { productId_lotNumber: { productId: product.id, lotNumber: rawLotNum } },
      });
    }

    if (
      lot &&
      lot.location &&
      cleanLoc !== 'S/U' &&
      normalizeWmsLocationCode(lot.location) !== cleanLoc &&
      change > 0
    ) {
      const locLotNum = `${rawLotNum}@${cleanLoc}`;
      const existingLocLot = await tx.productLot.findUnique({
        where: { productId_lotNumber: { productId: product.id, lotNumber: locLotNum } },
      });
      if (existingLocLot) {
        lot = existingLocLot;
      } else {
        lot = null;
        rawLotNum = locLotNum;
      }
    }

    if (!lot && cleanLoc !== 'S/U' && typeof (tx.productLot as any).findFirst === 'function') {
      lot = await tx.productLot.findFirst({
        where: {
          productId: product.id,
          OR: [{ location: cleanLoc }, { location: { startsWith: `${cleanLoc}-` } }],
        },
        orderBy: { expirationDate: 'asc' },
      });
    }

    if (!lot && change < 0 && typeof (tx.productLot as any).findFirst === 'function') {
      lot = await tx.productLot.findFirst({
        where: { productId: product.id, stock: { gt: 0 } },
        orderBy: { expirationDate: 'asc' },
      });
    }

    const finalTargetLotNum = rawLotNum || (cleanLoc !== 'S/U' ? `S/L-${cleanLoc}` : 'S/L');
    let finalExpDate = new Date('2036-12-31T00:00:00Z');
    if (expirationDate && typeof expirationDate === 'string' && expirationDate.trim()) {
      const parsedDate = new Date(expirationDate);
      if (!isNaN(parsedDate.getTime())) finalExpDate = parsedDate;
    }

    if (!lot) {
      lot = await tx.productLot.create({
        data: {
          productId: product.id,
          lotNumber: finalTargetLotNum,
          expirationDate: finalExpDate,
          stock: change > 0 ? 0 : Math.abs(change),
          location: cleanLoc,
        },
      });
    }

    const isVacateAction =
      change < 0 &&
      reason &&
      (reason.includes('Vaciam') || reason.includes('Elimina') || reason.includes('Retiro'));
    const effectiveSubQty = isVacateAction ? lot.stock : Math.min(lot.stock, Math.abs(change));
    const actualChange = change < 0 ? -effectiveSubQty : change;

    const updatedProductStock = Math.max(0, product.stock + actualChange);
    const realAppliedProductDelta = updatedProductStock - product.stock;
    const updatedLotStock =
      change < 0 ? Math.max(0, lot.stock - effectiveSubQty) : lot.stock + change;

    let lotDeleted = false;
    if (updatedLotStock <= 0) {
      try {
        await tx.productLot.delete({ where: { id: lot.id } });
        lotDeleted = true;
      } catch {
        await tx.productLot.update({
          where: { id: lot.id },
          data: { stock: 0, location: 'S/U' },
        });
      }
    } else {
      await tx.productLot.update({
        where: { id: lot.id },
        data: {
          stock: updatedLotStock,
          location: cleanLoc !== 'S/U' ? cleanLoc : lot.location,
        },
      });
    }

    const normalizedDefault = normalizeWmsLocationCode(product.defaultLocation);
    const clearDefaultLoc =
      updatedLotStock <= 0 &&
      cleanLoc !== 'S/U' &&
      (normalizedDefault === cleanLoc || normalizedDefault.startsWith(`${cleanLoc}-`));

    const updatedProduct = await tx.product.update({
      where: { id: product.id },
      data: {
        stock: updatedProductStock,
        ...(clearDefaultLoc ? { defaultLocation: null } : {}),
      },
    });

    const recordedQty = realAppliedProductDelta !== 0 ? realAppliedProductDelta : actualChange;
    const movement = await tx.stockMovement.create({
      data: {
        productId: product.id,
        quantity: recordedQty,
        type: recordedQty > 0 ? 'IN' : 'OUT',
        reason: reason || 'Ajuste de stock manual',
        userId,
        productLotId: lotDeleted ? null : lot ? lot.id : null,
      },
    });

    return { updatedProduct, movement, originalProduct: product };
  }

  /**
   * Ajustar stock físicamente con bloqueo de fila (`FOR UPDATE`) e invariante de Libro Mayor.
   */
  async adjustStock(id: number, data: any, userId: number) {
    const result = await prisma.$transaction(async (tx) => {
      await lockProductsForUpdate(tx, [id]);
      return this.applySingleAdjustmentInTx(tx, id, data, userId);
    });

    await logAudit({
      userId,
      action: 'ADJUST_STOCK',
      entityType: 'Product',
      entityId: id,
      oldValues: { stock: result.originalProduct.stock },
      newValues: {
        stock: result.updatedProduct.stock,
        movementId: result.movement.id,
        lotNumber: data?.lotNumber,
      },
    });

    const freshProduct = await prisma.product.findUnique({
      where: { id },
      include: { lots: { orderBy: { expirationDate: 'asc' } } },
    });

    return { product: freshProduct, movement: result.movement };
  }

  /**
   * Ajuste masivo atómico (Modo Inventario Rápido) en 1 sola transacción libre de deadlocks.
   */
  async adjustStockBatch(items: StockAdjustmentItemInput[], userId: number) {
    if (!Array.isArray(items) || items.length === 0) {
      throw new Error('No se enviaron ajustes de stock para procesar.');
    }

    const orderedItems = [...items].sort((a, b) => a.productId - b.productId);
    const applied = await prisma.$transaction(async (tx) => {
      await lockProductsForUpdate(
        tx,
        orderedItems.map((i) => i.productId),
      );

      const results = [];
      for (const item of orderedItems) {
        const res = await this.applySingleAdjustmentInTx(tx, item.productId, item, userId);
        results.push({
          productId: item.productId,
          previousStock: res.originalProduct.stock,
          newStock: res.updatedProduct.stock,
          movementId: res.movement.id,
          appliedDelta: res.movement.quantity,
        });
      }
      return results;
    });

    await logAudit({
      userId,
      action: 'ADJUST_STOCK_BATCH',
      entityType: 'Product',
      entityId: 0,
      newValues: { count: applied.length, adjustments: applied },
    });

    return { appliedCount: applied.length, adjustments: applied };
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
