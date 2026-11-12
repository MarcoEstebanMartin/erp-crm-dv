import { MovementType, Prisma } from '@prisma/client';
import {
  roundToIntegerPeso,
  roundToThreeDecimalsWeight,
  sumIntegerAmounts,
  toDecimal,
} from '../../core/money';
import { extractBaseLotNumber, normalizeWmsLocationCode } from '../../engines/stock.engine';

export async function processOrderPreparedLotAssignments(
  tx: Prisma.TransactionClient,
  params: {
    orderId: number;
    sellerId: number;
    userId: number;
    lotAssignments?: Record<number, { lotId: number; quantity: number }[]>;
  },
): Promise<number> {
  const { orderId, sellerId, userId, lotAssignments } = params;
  if (!lotAssignments) {
    throw new Error('Las asignaciones de lote son requeridas para marcar el pedido como Armado.');
  }

  const items = await tx.orderItem.findMany({
    where: { orderId },
    include: { product: true },
  });

  const updatedSubtotals: number[] = [];

  for (const item of items) {
    const userAssignments = lotAssignments[item.id] || [];
    const totalUserAssigned = userAssignments.reduce(
      (sum: number, a: any) => sum + Number(a.quantity),
      0,
    );

    if (totalUserAssigned > item.quantity) {
      throw new Error(
        `Asignación inválida para "${item.product.name}". Cantidad asignada (${totalUserAssigned}) supera la cantidad pedida (${item.quantity}).`,
      );
    }

    const finalAssignments: { lotId: number; quantity: number }[] = [];
    for (const uAs of userAssignments) {
      const q = Number(uAs.quantity);
      if (q > 0) {
        finalAssignments.push({ lotId: Number(uAs.lotId), quantity: q });
      }
    }

    let remainingToAssign = item.quantity - totalUserAssigned;
    if (remainingToAssign > 0) {
      const activeLots = await tx.productLot.findMany({
        where: {
          productId: item.productId,
          stock: { gt: 0 },
          id: { notIn: finalAssignments.map((fa) => fa.lotId) },
        },
        orderBy: { expirationDate: 'asc' },
      });
      // FEFO determinístico: ante empate de vencimiento (ej. varios 'S/L'), primero Sin Ubicar y luego id ASC.
      activeLots.sort(
        (a, b) =>
          new Date(a.expirationDate).getTime() - new Date(b.expirationDate).getTime() ||
          Number(normalizeWmsLocationCode(a.location) !== 'S/U') -
            Number(normalizeWmsLocationCode(b.location) !== 'S/U') ||
          a.id - b.id,
      );

      for (const lot of activeLots) {
        if (remainingToAssign <= 0) break;
        const allocatedQty = Math.min(lot.stock, remainingToAssign);
        if (allocatedQty > 0) {
          finalAssignments.push({ lotId: lot.id, quantity: allocatedQty });
          remainingToAssign -= allocatedQty;
        }
      }

      if (remainingToAssign > 0 && process.env.IGNORE_STOCK_CHECK === 'true') {
        let slLot = await tx.productLot.findFirst({
          where: { productId: item.productId, lotNumber: 'S/L', location: 'S/U' },
        });
        if (!slLot) {
          slLot = await tx.productLot.create({
            data: {
              productId: item.productId,
              lotNumber: 'S/L',
              expirationDate: new Date('2036-12-31T00:00:00Z'),
              stock: 0,
              location: 'S/U',
            },
          });
        }
        finalAssignments.push({ lotId: slLot.id, quantity: remainingToAssign });
        remainingToAssign = 0;
      }
    }

    const totalAssigned = finalAssignments.reduce((sum, a) => sum + a.quantity, 0);
    const diff = item.quantity - totalAssigned;
    if (diff > 0) {
      await tx.product.update({
        where: { id: item.productId },
        data: { stock: { increment: diff } },
      });

      await tx.stockMovement.create({
        data: {
          productId: item.productId,
          quantity: diff,
          type: MovementType.IN,
          orderId,
          referenceId: `PICK-SHORT-${orderId}`,
          userId,
          reason: `Devolución por faltante en preparación de Pedido #${orderId}`,
        },
      });
    }

    let newSubtotal = roundToIntegerPeso(item.subtotal).toNumber();
    let newWeight = item.weight ? roundToThreeDecimalsWeight(item.weight).toNumber() : null;
    if (totalAssigned === 0) {
      newSubtotal = 0;
      newWeight = 0;
    } else if (item.product.isPesable && newWeight !== null && newWeight > 0) {
      newSubtotal = roundToIntegerPeso(toDecimal(item.unitPrice).times(newWeight)).toNumber();
    } else {
      newSubtotal = roundToIntegerPeso(toDecimal(item.unitPrice).times(totalAssigned)).toNumber();
    }

    await tx.orderItem.update({
      where: { id: item.id },
      data: {
        quantity: totalAssigned,
        subtotal: newSubtotal,
        weight: newWeight,
      },
    });

    updatedSubtotals.push(newSubtotal);

    for (const assignment of finalAssignments) {
      const { lotId, quantity } = assignment;
      const lot = await tx.productLot.findUnique({ where: { id: lotId } });
      if (!lot) continue;

      await tx.productLot.update({
        where: { id: lot.id },
        data: { stock: { decrement: quantity } },
      });

      await tx.orderItemLot.create({
        data: {
          orderItemId: item.id,
          productLotId: lot.id,
          quantity,
        },
      });

      const originalMov = await tx.stockMovement.findFirst({
        where: {
          productId: item.productId,
          referenceId: `ORDER-${orderId}`,
          productLotId: null,
        },
      });

      if (originalMov) {
        await tx.stockMovement.update({
          where: { id: originalMov.id },
          data: { productLotId: lot.id, orderId },
        });
      } else {
        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            quantity: -quantity,
            type: MovementType.OUT,
            orderId,
            referenceId: `ORDER-${orderId}`,
            userId: sellerId,
            reason: `Venta - Descuento físico de Lote #${extractBaseLotNumber(lot.lotNumber)}${
              normalizeWmsLocationCode(lot.location) !== 'S/U' ? ` (${lot.location})` : ''
            } para Pedido #${orderId}`,
            productLotId: lot.id,
          },
        });
      }
    }
  }

  return sumIntegerAmounts(updatedSubtotals).toNumber();
}
