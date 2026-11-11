import prisma from '../../utils/prisma';
import { logAudit } from '../../utils/audit';

export class ProductStockSubService {
  /**
   * Ajustar stock físicamente manteniendo la invariante del Libro Mayor (StockMovement).
   */
  async adjustStock(id: number, data: any, userId: number) {
    const { quantityChange, reason, lotNumber, expirationDate, location, lotId: inputLotId } = data;
    const change = Math.trunc(Number(quantityChange));
    if (!Number.isFinite(change) || change === 0) {
      throw new Error('El ajuste de stock debe ser un número entero distinto de cero.');
    }
    const cleanLoc =
      location && typeof location === 'string' && location.trim()
        ? location.trim().toUpperCase()
        : 'S/U';

    const result = await prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({ where: { id } });
      if (!product) throw new Error('Producto no encontrado.');
      if (change < 0 && product.stock <= 0) {
        throw new Error('El producto ya tiene stock en 0; no hay unidades para descontar.');
      }

      let lot: any = null;
      if (inputLotId) {
        lot = await tx.productLot.findUnique({ where: { id: Number(inputLotId) } });
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
        lot.location.toUpperCase().trim() !== cleanLoc &&
        change > 0
      ) {
        const locLotNum = `${rawLotNum}-${cleanLoc}`;
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

      if (!lot && cleanLoc !== 'S/U') {
        lot = await tx.productLot.findFirst({
          where: {
            productId: product.id,
            OR: [
              { location: cleanLoc },
              { location: { startsWith: `${cleanLoc}-` } },
              { location: { contains: cleanLoc } },
            ],
          },
        });
      }

      if (!lot && change < 0) {
        lot = await tx.productLot.findFirst({
          where: { productId: product.id, stock: { gt: 0 } },
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

      const clearDefaultLoc =
        (updatedLotStock <= 0 || change < 0) &&
        product.defaultLocation &&
        cleanLoc !== 'S/U' &&
        product.defaultLocation.toUpperCase().includes(cleanLoc);

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
    });

    await logAudit({
      userId,
      action: 'ADJUST_STOCK',
      entityType: 'Product',
      entityId: id,
      oldValues: { stock: result.originalProduct.stock },
      newValues: { stock: result.updatedProduct.stock, movementId: result.movement.id, lotNumber },
    });

    const freshProduct = await prisma.product.findUnique({
      where: { id },
      include: { lots: { orderBy: { expirationDate: 'asc' } } },
    });

    return { product: freshProduct, movement: result.movement };
  }

  async getProductMovements(productId: number) {
    return prisma.stockMovement.findMany({
      where: { productId },
      include: {
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
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getGlobalStockMovements() {
    return prisma.stockMovement.findMany({
      take: 50,
      include: {
        product: { select: { id: true, sku: true, name: true } },
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
      },
      orderBy: { createdAt: 'desc' },
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
