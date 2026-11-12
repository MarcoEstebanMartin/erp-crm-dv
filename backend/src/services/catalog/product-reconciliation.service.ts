import prisma from '../../utils/prisma';
import { logAudit } from '../../utils/audit';
import { lockProductsForUpdate } from '../../utils/db-locks.util';

export class ProductReconciliationSubService {
  async reconcileStockAudit() {
    const products = await prisma.product.findMany({
      include: { lots: true },
      orderBy: { sku: 'asc' },
    });

    const reservations = await prisma.orderItem.groupBy({
      by: ['productId'],
      where: { order: { status: { in: ['PENDING', 'PREPARING'] } } },
      _sum: { quantity: true },
    });

    const reservationMap = new Map<number, number>();
    for (const res of reservations) {
      reservationMap.set(res.productId, res._sum.quantity || 0);
    }

    const driftProducts = [];
    for (const product of products) {
      const sumLotsStock = product.lots.reduce((sum, lot) => sum + lot.stock, 0);
      const reservedQty = reservationMap.get(product.id) || 0;
      const theoreticalStock = sumLotsStock - reservedQty;
      const drift = product.stock - theoreticalStock;

      if (drift !== 0) {
        driftProducts.push({
          id: product.id,
          sku: product.sku,
          name: product.name,
          stockActual: product.stock,
          stockLotes: sumLotsStock,
          reservas: reservedQty,
          stockTeorico: theoreticalStock,
          discrepancia: drift,
        });
      }
    }
    return driftProducts;
  }

  async executeStockReconciliation(userId: number) {
    const driftProducts = await this.reconcileStockAudit();
    if (driftProducts.length === 0) {
      return { message: 'No se detectaron descalces de stock. Inventario consistente.', count: 0 };
    }

    const CHUNK_SIZE = 35;
    const allReconciled: any[] = [];

    for (let idx = 0; idx < driftProducts.length; idx += CHUNK_SIZE) {
      const chunk = driftProducts.slice(idx, idx + CHUNK_SIZE);
      const chunkIds = chunk.map((c) => c.id);

      const chunkResult = await prisma.$transaction(
        async (tx) => {
          await lockProductsForUpdate(tx, chunkIds);

          const existingLots = await tx.productLot.findMany({
            where: { productId: { in: chunkIds } },
            orderBy: [{ expirationDate: 'desc' }, { stock: 'desc' }],
          });

          const lotsByProduct = new Map<number, any[]>();
          for (const lot of existingLots) {
            const arr = lotsByProduct.get(lot.productId) || [];
            arr.push(lot);
            lotsByProduct.set(lot.productId, arr);
          }

          const list = [];
          const movementsBuffer: any[] = [];

          for (const item of chunk) {
            const prodLots = lotsByProduct.get(item.id) || [];

            if (item.discrepancia > 0) {
              let defaultLot = prodLots.find((l) => l.lotNumber === 'S/L');
              if (!defaultLot) {
                defaultLot = await tx.productLot.create({
                  data: {
                    productId: item.id,
                    lotNumber: 'S/L',
                    expirationDate: new Date('2036-12-31T00:00:00Z'),
                    stock: item.discrepancia,
                    location: 'S/U',
                  },
                });
                prodLots.push(defaultLot);
                lotsByProduct.set(item.id, prodLots);
              } else {
                const newLotStock = defaultLot.stock + item.discrepancia;
                await tx.productLot.update({
                  where: { id: defaultLot.id },
                  data: { stock: newLotStock },
                });
                defaultLot.stock = newLotStock;
              }

              movementsBuffer.push({
                productId: item.id,
                quantity: item.discrepancia,
                type: 'ADJUSTMENT',
                reason: `Conciliación automática de inventario (Desvío corregido: +${item.discrepancia} u.)`,
                userId,
                productLotId: defaultLot.id,
              });

              list.push({
                sku: item.sku,
                name: item.name,
                discrepancia: item.discrepancia,
                loteModificado: 'S/L',
                nuevoStockLote: defaultLot.stock,
              });
            } else {
              let remainingToDeduct = Math.abs(item.discrepancia);
              const candidateLots = prodLots.filter((l) => l.stock > 0);
              const orderedLots = [
                ...candidateLots.filter((l) => l.lotNumber === 'S/L'),
                ...candidateLots.filter((l) => l.lotNumber !== 'S/L'),
              ];

              for (const lot of orderedLots) {
                if (remainingToDeduct <= 0) break;
                const take = Math.min(lot.stock, remainingToDeduct);
                if (take <= 0) continue;
                const newLotStock = lot.stock - take;
                await tx.productLot.update({
                  where: { id: lot.id },
                  data: { stock: newLotStock },
                });
                lot.stock = newLotStock;

                movementsBuffer.push({
                  productId: item.id,
                  quantity: -take,
                  type: 'ADJUSTMENT',
                  reason: `Conciliación automática de inventario (Exceso en lote ${lot.lotNumber}: -${take} u.)`,
                  userId,
                  productLotId: lot.id,
                });

                remainingToDeduct -= take;
                list.push({
                  sku: item.sku,
                  name: item.name,
                  discrepancia: -take,
                  loteModificado: lot.lotNumber,
                  nuevoStockLote: newLotStock,
                });
              }
            }
          }

          if (movementsBuffer.length > 0) {
            if (typeof (tx.stockMovement as any).createMany === 'function') {
              await tx.stockMovement.createMany({ data: movementsBuffer });
            } else {
              for (const mov of movementsBuffer) {
                await tx.stockMovement.create({ data: mov });
              }
            }
          }

          return list;
        },
        { maxWait: 10000, timeout: 25000 },
      );

      allReconciled.push(...chunkResult);
    }

    await logAudit({
      userId,
      action: 'RECONCILE_STOCK_DRIFT',
      entityType: 'Product',
      entityId: 0,
      newValues: allReconciled,
    });

    return {
      message: 'Conciliación de inventario completada con éxito.',
      count: allReconciled.length,
      details: allReconciled,
    };
  }
}

export const productReconciliationSubService = new ProductReconciliationSubService();
