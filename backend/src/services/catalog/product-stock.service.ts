import { MovementType, Prisma } from '@prisma/client';
import prisma from '../../utils/prisma';
import { logAudit } from '../../utils/audit';
import { lockProductsForUpdate } from '../../utils/db-locks.util';
import { normalizeWmsLocationCode, resolveAdjustmentLot } from '../../engines/stock.engine';

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

const SENTINEL_EXPIRATION = '2036-12-31T00:00:00Z';

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

/** Vencimiento del lote a crear: el indicado por el usuario, el heredado del mismo lote en otro rack o el centinela. */
function resolveCreationExpiration(rawDate: unknown, inherited: Date | null): Date {
  if (typeof rawDate === 'string' && rawDate.trim()) {
    const parsed = new Date(rawDate);
    if (!isNaN(parsed.getTime())) return parsed;
  }
  return inherited || new Date(SENTINEL_EXPIRATION);
}

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

    // Identidad física única (productId, lotNumber, location): jamás se fabrican sufijos @SLOT / S/L-SLOT.
    const needsLookup =
      !lot || (change > 0 && cleanLoc !== 'S/U' && normalizeWmsLocationCode(lot.location) !== cleanLoc);
    let createLotNumber = 'S/L';
    let inheritedExp: Date | null = null;
    if (needsLookup) {
      const productLots = await tx.productLot.findMany({
        where: { productId: product.id },
        orderBy: [{ expirationDate: 'asc' }, { id: 'asc' }],
      });
      const resolution = resolveAdjustmentLot({
        lots: productLots,
        preselectedLot: lot,
        lotNumber,
        location: cleanLoc,
        change,
      });
      lot = resolution.lotId ? productLots.find((l) => l.id === resolution.lotId) || null : null;
      createLotNumber = resolution.createLotNumber;
      inheritedExp = resolution.createExpiration;
    }

    if (!lot) {
      lot = await tx.productLot.create({
        data: {
          productId: product.id,
          lotNumber: createLotNumber,
          expirationDate: resolveCreationExpiration(expirationDate, inheritedExp),
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

    // El lote vaciado conserva su fila y ubicación (stock 0) para preservar el historial del Kardex.
    // No se intenta DELETE: un error de FK abortaría la transacción completa en PostgreSQL.
    await tx.productLot.update({
      where: { id: lot.id },
      data: { stock: updatedLotStock },
    });

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
        productLotId: lot.id,
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
    const applied = await prisma.$transaction(
      async (tx) => {
        const uniqueProductIds = Array.from(new Set(orderedItems.map((i) => i.productId)));
        await lockProductsForUpdate(tx, uniqueProductIds);

        // Si el cliente Prisma completo está disponible (producción/desarrollo), precargamos en 2 consultas para evitar N+1
        const canBulkPreload =
          typeof (tx.product as any).findMany === 'function' &&
          typeof (tx.productLot as any).findMany === 'function' &&
          typeof (tx.stockMovement as any).createMany === 'function';

        if (!canBulkPreload) {
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
        }

        const [productsList, lotsList] = await Promise.all([
          tx.product.findMany({ where: { id: { in: uniqueProductIds } } }),
          tx.productLot.findMany({
            where: { productId: { in: uniqueProductIds } },
            orderBy: [{ expirationDate: 'asc' }, { id: 'asc' }],
          }),
        ]);

        const productMap = new Map<number, any>(productsList.map((p) => [p.id, { ...p }]));
        const lotsMap = new Map<number, any[]>();
        for (const lot of lotsList) {
          const arr = lotsMap.get(lot.productId) || [];
          arr.push({ ...lot });
          lotsMap.set(lot.productId, arr);
        }

        const results = [];
        const movementsToCreate: any[] = [];

        for (const item of orderedItems) {
          const change = Math.trunc(Number(item.quantityChange));
          if (!Number.isFinite(change) || change === 0) {
            throw new Error('El ajuste de stock debe ser un número entero distinto de cero.');
          }
          const cleanLoc = normalizeWmsLocationCode(item.location);
          const product = productMap.get(item.productId);
          if (!product) throw new Error(`Producto #${item.productId} no encontrado.`);
          if (change < 0 && product.stock <= 0) {
            throw new Error(
              `El producto "${product.name || product.id}" ya tiene stock en 0; no hay unidades para descontar.`,
            );
          }

          const prodLots = lotsMap.get(product.id) || [];
          const preselected = item.lotId ? prodLots.find((l) => l.id === Number(item.lotId)) || null : null;
          const resolution = resolveAdjustmentLot({
            lots: prodLots,
            preselectedLot: preselected,
            lotNumber: item.lotNumber,
            location: cleanLoc,
            change,
          });
          let lot: any = resolution.lotId ? prodLots.find((l) => l.id === resolution.lotId) || null : null;

          if (!lot) {
            lot = await tx.productLot.create({
              data: {
                productId: product.id,
                lotNumber: resolution.createLotNumber,
                expirationDate: resolveCreationExpiration(item.expirationDate, resolution.createExpiration),
                stock: change > 0 ? change : 0,
                location: cleanLoc,
              },
            });
            prodLots.push(lot);
            lotsMap.set(product.id, prodLots);
          } else {
            const subQty = change < 0 ? Math.min(lot.stock, Math.abs(change)) : 0;
            const updatedLotStock = change < 0 ? Math.max(0, lot.stock - subQty) : lot.stock + change;
            await tx.productLot.update({
              where: { id: lot.id },
              data: { stock: updatedLotStock },
            });
            lot.stock = updatedLotStock;
          }

          const prevStock = product.stock;
          const actualChange = change < 0 ? -Math.min(prevStock, Math.abs(change)) : change;
          const nextStock = Math.max(0, prevStock + actualChange);
          const appliedDelta = nextStock - prevStock;

          await tx.product.update({
            where: { id: product.id },
            data: { stock: nextStock },
          });
          product.stock = nextStock;

          const recordedQty = appliedDelta !== 0 ? appliedDelta : actualChange;
          movementsToCreate.push({
            productId: product.id,
            quantity: recordedQty,
            type: recordedQty > 0 ? 'IN' : 'OUT',
            reason: item.reason || 'Ajuste rápido de inventario',
            userId,
            productLotId: lot.id,
          });

          results.push({
            productId: product.id,
            previousStock: prevStock,
            newStock: nextStock,
            movementId: 0,
            appliedDelta: recordedQty,
          });
        }

        if (movementsToCreate.length > 0) {
          await tx.stockMovement.createMany({ data: movementsToCreate });
        }

        return results;
      },
      { maxWait: 10000, timeout: 30000 },
    );

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
