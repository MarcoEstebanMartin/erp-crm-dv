import { MovementType } from '@prisma/client';

export function resolveCreditNoteAfipDocMeta(cuit?: string | null): {
  cleanCuit: string;
  docType: number;
  isA: boolean;
  creditNoteType: string;
} {
  const cleanCuit = cuit ? cuit.replace(/-/g, '').trim() : '';
  if (cleanCuit.length === 11) {
    return { cleanCuit, docType: 80, isA: true, creditNoteType: 'NOTA_CREDITO_A' };
  }
  if (cleanCuit.length === 7 || cleanCuit.length === 8) {
    return { cleanCuit, docType: 96, isA: false, creditNoteType: 'NOTA_CREDITO_B' };
  }
  return { cleanCuit, docType: 99, isA: false, creditNoteType: 'NOTA_CREDITO_B' };
}

/**
 * Restaura stock general, distribuye la devolución proporcionalmente sobre los lotes originales
 * del pedido (o lote de contingencia 'S/L') y asienta el movimiento auditable StockMovement.IN.
 */
export async function restoreReturnedStockAndLots(
  tx: any,
  params: {
    creditNoteId: number;
    creditNoteNumber: string | null;
    orderId: number | null;
    userId: number;
    reasonLabel: string;
    items: Array<{ productId: number; quantity: number }>;
  },
): Promise<void> {
  for (const item of params.items) {
    const productId = Number(item.productId);
    const qty = Number(item.quantity);

    const product = await tx.product.findUnique({ where: { id: productId } });
    if (!product) continue;

    await tx.product.update({
      where: { id: productId },
      data: { stock: { increment: qty } },
    });

    let assignedLotId: number | null = null;
    let remainingToReturn = qty;

    if (params.orderId) {
      const orderItem = await tx.orderItem.findFirst({
        where: { orderId: params.orderId, productId },
        include: { orderItemLots: true },
      });

      if (orderItem && orderItem.orderItemLots.length > 0) {
        for (const oil of orderItem.orderItemLots) {
          if (remainingToReturn <= 0) break;
          const toReturn = Math.min(oil.quantity, remainingToReturn);
          if (toReturn > 0) {
            await tx.productLot.update({
              where: { id: oil.productLotId },
              data: { stock: { increment: toReturn } },
            });
            remainingToReturn -= toReturn;
            if (!assignedLotId) assignedLotId = oil.productLotId;
          }
        }

        if (remainingToReturn > 0) {
          const firstLot = orderItem.orderItemLots[0];
          await tx.productLot.update({
            where: { id: firstLot.productLotId },
            data: { stock: { increment: remainingToReturn } },
          });
          remainingToReturn = 0;
          if (!assignedLotId) assignedLotId = firstLot.productLotId;
        }
      }
    }

    if (!assignedLotId || remainingToReturn > 0) {
      const qtyToIncrement = remainingToReturn > 0 ? remainingToReturn : qty;
      let defaultLot = await tx.productLot.findFirst({
        where: { productId, lotNumber: 'S/L' },
      });

      if (!defaultLot) {
        defaultLot = await tx.productLot.findFirst({
          where: { productId },
          orderBy: { id: 'asc' },
        });
      }

      if (defaultLot) {
        await tx.productLot.update({
          where: { id: defaultLot.id },
          data: { stock: { increment: qtyToIncrement } },
        });
        assignedLotId = defaultLot.id;
      } else {
        const newLot = await tx.productLot.create({
          data: {
            productId,
            lotNumber: 'S/L',
            expirationDate: new Date('2036-12-31T00:00:00Z'),
            stock: qtyToIncrement,
          },
        });
        assignedLotId = newLot.id;
      }
    }

    await tx.stockMovement.create({
      data: {
        productId,
        quantity: qty,
        type: MovementType.IN,
        creditNoteId: params.creditNoteId,
        orderId: params.orderId,
        referenceId: `NC-${params.creditNoteId}`,
        userId: params.userId,
        reason: params.reasonLabel,
        productLotId: assignedLotId,
      },
    });
  }
}
