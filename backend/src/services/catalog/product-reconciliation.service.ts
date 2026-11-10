import prisma from '../../utils/prisma';
import { logAudit } from '../../utils/audit';

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

    const reconciledList = await prisma.$transaction(async (tx) => {
      const list = [];
      for (const item of driftProducts) {
        let defaultLot = await tx.productLot.findUnique({
          where: { productId_lotNumber: { productId: item.id, lotNumber: 'S/L' } },
        });
        if (!defaultLot) {
          defaultLot = await tx.productLot.create({
            data: {
              productId: item.id,
              lotNumber: 'S/L',
              expirationDate: new Date('2036-12-31T00:00:00Z'),
              stock: 0,
              location: 'S/U',
            },
          });
        }
        const newLotStock = defaultLot.stock + item.discrepancia;
        await tx.productLot.update({ where: { id: defaultLot.id }, data: { stock: newLotStock } });
        await tx.stockMovement.create({
          data: {
            productId: item.id,
            quantity: item.discrepancia,
            type: 'ADJUSTMENT',
            reason: `Conciliación automática de inventario (Desvío corregido: ${item.discrepancia} u.)`,
            userId,
            productLotId: defaultLot.id,
          },
        });
        list.push({
          sku: item.sku,
          name: item.name,
          discrepancia: item.discrepancia,
          loteModificado: 'S/L',
          nuevoStockLote: newLotStock,
        });
      }
      return list;
    });

    await logAudit({
      userId,
      action: 'RECONCILE_STOCK_DRIFT',
      entityType: 'Product',
      entityId: 0,
      newValues: reconciledList,
    });

    return {
      message: 'Conciliación de inventario completada con éxito.',
      count: reconciledList.length,
      details: reconciledList,
    };
  }
}

export const productReconciliationSubService = new ProductReconciliationSubService();
