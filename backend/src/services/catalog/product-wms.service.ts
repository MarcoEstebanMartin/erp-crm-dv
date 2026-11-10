import prisma from '../../utils/prisma';
import { logAudit } from '../../utils/audit';

export class ProductWmsSubService {
  /**
   * Vaciar limpiamente una posición WMS liberando todos los lotes y referencias.
   */
  async clearWmsLocation(locationCode: string, userId: number) {
    if (!locationCode || typeof locationCode !== 'string' || !locationCode.trim()) {
      throw new Error('El código de ubicación es obligatorio.');
    }
    const cleanLoc = locationCode.trim().toUpperCase();

    const result = await prisma.$transaction(async (tx) => {
      const matchingLots = await tx.productLot.findMany({
        where: {
          OR: [
            { location: cleanLoc },
            { location: { startsWith: `${cleanLoc}-` } },
            { location: { contains: cleanLoc } },
          ],
        },
        include: { product: true },
      });

      for (const lot of matchingLots) {
        await tx.productLot.update({
          where: { id: lot.id },
          data: { location: 'S/U', stock: 0 },
        });

        await tx.stockMovement.create({
          data: {
            productId: lot.productId,
            quantity: -lot.stock,
            type: 'ADJUSTMENT',
            reason: `Vaciado definitivo de ubicación ${cleanLoc} desde Mapa WMS`,
            userId,
            productLotId: lot.id,
          },
        });
      }

      const matchingProducts = await tx.product.findMany({
        where: {
          OR: [
            { defaultLocation: cleanLoc },
            { defaultLocation: { startsWith: `${cleanLoc}-` } },
            { defaultLocation: { contains: cleanLoc } },
          ],
        },
      });

      for (const prod of matchingProducts) {
        await tx.product.update({
          where: { id: prod.id },
          data: { defaultLocation: null },
        });
      }

      return {
        clearedLotsCount: matchingLots.length,
        clearedProductsCount: matchingProducts.length,
      };
    });

    await logAudit({
      userId,
      action: 'CLEAR_WMS_LOCATION',
      entityType: 'ProductLot',
      entityId: 0,
      newValues: { locationCode: cleanLoc, result },
    });

    return {
      message: `Posición ${cleanLoc} liberada y vaciada con éxito.`,
      result,
    };
  }

  /**
   * Asignar de forma limpia un producto/lote a una posición WMS.
   */
  async assignWmsLocation(
    data: {
      productId: number;
      locationCode: string;
      quantity: number;
      lotNumber?: string;
      expirationDate?: string;
    },
    userId: number,
  ) {
    const { productId, locationCode, quantity, lotNumber, expirationDate } = data;
    if (!productId || !locationCode) {
      throw new Error('Producto y código de ubicación son obligatorios.');
    }

    const cleanLoc = locationCode.trim().toUpperCase();
    const qty = Math.max(0, Number(quantity) || 0);

    const result = await prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({ where: { id: Number(productId) } });
      if (!product) throw new Error('Producto no encontrado.');

      await tx.product.update({
        where: { id: product.id },
        data: { defaultLocation: cleanLoc },
      });

      const rawLotNum =
        lotNumber && typeof lotNumber === 'string' && lotNumber.trim()
          ? lotNumber.trim()
          : `S/L-${cleanLoc}`;

      let expDate = new Date('2036-12-31T00:00:00Z');
      if (expirationDate && typeof expirationDate === 'string' && expirationDate.trim()) {
        const parsed = new Date(expirationDate);
        if (!isNaN(parsed.getTime())) expDate = parsed;
      }

      let lot = await tx.productLot.findUnique({
        where: { productId_lotNumber: { productId: product.id, lotNumber: rawLotNum } },
      });

      if (lot) {
        lot = await tx.productLot.update({
          where: { id: lot.id },
          data: { location: cleanLoc, stock: qty > 0 ? qty : lot.stock },
        });
      } else {
        lot = await tx.productLot.create({
          data: {
            productId: product.id,
            lotNumber: rawLotNum,
            expirationDate: expDate,
            stock: qty,
            location: cleanLoc,
          },
        });
      }

      if (qty > 0) {
        await tx.product.update({
          where: { id: product.id },
          data: { stock: Math.max(product.stock, qty) },
        });
      }

      await tx.stockMovement.create({
        data: {
          productId: product.id,
          quantity: qty,
          type: 'ADJUSTMENT',
          reason: `Asignación directa a ubicación ${cleanLoc} desde Mapa WMS`,
          userId,
          productLotId: lot.id,
        },
      });

      return { product, lot };
    });

    await logAudit({
      userId,
      action: 'ASSIGN_WMS_LOCATION',
      entityType: 'Product',
      entityId: Number(productId),
      newValues: { locationCode: cleanLoc, quantity: qty },
    });

    return {
      message: `Producto asignado a la posición ${cleanLoc} correctamente.`,
      result,
    };
  }
}

export const productWmsSubService = new ProductWmsSubService();
