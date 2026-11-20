import prisma from '../../utils/prisma';
import { OrderStatus, MovementType } from '@prisma/client';
import {
  roundToIntegerPeso,
  roundToThreeDecimalsWeight,
  sumIntegerAmounts,
  toDecimal,
} from '../../core/money';
import { notifyWebOrderStatusForErpOrder } from './web-order-status-bridge.service';
import { lockProductsForUpdate } from '../../utils/db-locks.util';
import { adjustAssignedOrderItemLotsInTx } from './order-lot-picking.helper';

export class OrderScaleService {
  /**
   * Actualiza los pesos exactos de productos pesables antes de facturar
   * y recalcula los subtotales en pesos enteros y el total del pedido con Decimal.js.
   */
  static async updateOrderWeights(
    orderId: number,
    itemWeights: { orderItemId: number; weight: number }[],
  ) {
    return await prisma.$transaction(async (tx) => {
      if (typeof tx.$queryRaw === 'function') {
        await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${orderId} FOR UPDATE`;
      }

      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: { items: { include: { product: true } } },
      });

      if (!order) throw new Error('Pedido no encontrado.');
      if (
        !(
          [OrderStatus.PENDING, OrderStatus.PREPARING, OrderStatus.PREPARED] as OrderStatus[]
        ).includes(order.status as OrderStatus)
      ) {
        throw new Error(
          'Solo se pueden ajustar pesos en pedidos PENDIENTES, EN PREPARACIÓN o PREPARADOS antes de facturar.',
        );
      }

      const subtotals: number[] = [];

      for (const item of order.items) {
        let subtotal = roundToIntegerPeso(item.subtotal).toNumber();
        const weightUpdate = itemWeights.find((w) => w.orderItemId === item.id);

        if (item.product.isPesable && weightUpdate && weightUpdate.weight > 0) {
          const cleanWeight = roundToThreeDecimalsWeight(weightUpdate.weight);
          subtotal = roundToIntegerPeso(toDecimal(item.unitPrice).times(cleanWeight)).toNumber();
          await tx.orderItem.update({
            where: { id: item.id },
            data: { weight: cleanWeight.toNumber(), subtotal },
          });
        }

        subtotals.push(subtotal);
      }

      const newTotal = sumIntegerAmounts(subtotals).toNumber();

      return await tx.order.update({
        where: { id: orderId },
        data: { totalAmount: newTotal },
        include: { items: { include: { product: true } }, persona: true },
      });
    });
  }

  /**
   * Confirma el armado (Picking rápido): Actualiza pesos y/o pone en 0 cantidades (faltantes)
   * y pasa el pedido a PREPARED con exactitud en pesos enteros.
   */
  static async confirmArmado(
    orderId: number,
    itemUpdates: { orderItemId: number; quantity?: number; weight?: number }[],
  ) {
    return await prisma.$transaction(async (tx) => {
      if (typeof tx.$queryRaw === 'function') {
        await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${orderId} FOR UPDATE`;
      }

      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: { items: { include: { product: true, orderItemLots: true } } },
      });

      if (!order) throw new Error('Pedido no encontrado.');
      if (
        !(
          [OrderStatus.PENDING, OrderStatus.PREPARING, OrderStatus.PREPARED] as OrderStatus[]
        ).includes(order.status as OrderStatus)
      ) {
        throw new Error(
          'El pedido debe estar pendiente, en preparación o preparado para confirmar el armado.',
        );
      }

      await lockProductsForUpdate(
        tx,
        order.items.map((i) => i.productId),
      );

      const subtotals: number[] = [];

      for (const item of order.items) {
        let currentQuantity = item.quantity;
        let subtotal = roundToIntegerPeso(item.subtotal).toNumber();
        let weightUpdate = item.weight ? roundToThreeDecimalsWeight(item.weight).toNumber() : null;
        const update = itemUpdates.find((u) => u.orderItemId === item.id);

        if (update) {
          if (update.quantity !== undefined) currentQuantity = update.quantity;
          if (update.weight !== undefined) {
            weightUpdate = roundToThreeDecimalsWeight(update.weight).toNumber();
          }

          if (currentQuantity === 0) {
            subtotal = 0;
            weightUpdate = 0;
          } else if (item.product.isPesable && weightUpdate !== null && weightUpdate > 0) {
            subtotal = roundToIntegerPeso(toDecimal(item.unitPrice).times(weightUpdate)).toNumber();
          } else {
            subtotal = roundToIntegerPeso(
              toDecimal(item.unitPrice).times(currentQuantity),
            ).toNumber();
          }

          const diff = item.quantity - currentQuantity;
          if (diff !== 0) {
            if (
              diff < 0 &&
              process.env.IGNORE_STOCK_CHECK !== 'true' &&
              typeof tx.product?.updateMany === 'function'
            ) {
              const extraNeeded = Math.abs(diff);
              const updatedRes = await tx.product.updateMany({
                where: { id: item.productId, stock: { gte: extraNeeded } },
                data: { stock: { decrement: extraNeeded } },
              });
              if (updatedRes.count === 0) {
                throw new Error(
                  `Stock insuficiente para aumentar la cantidad de "${item.product.name}" en el armado.`,
                );
              }
            } else {
              await tx.product.update({
                where: { id: item.productId },
                data: { stock: { increment: diff } },
              });
            }

            await tx.stockMovement.create({
              data: {
                productId: item.productId,
                quantity: diff,
                type: diff > 0 ? MovementType.IN : MovementType.OUT,
                orderId: order.id,
                referenceId: `ADJUST-ARMADO-${order.id}`,
                userId: order.sellerId,
                reason: `Ajuste en armado de Pedido #${order.id} (${diff > 0 ? 'Devolución de faltante' : 'Descuento adicional'})`,
              },
            });
          }

          await tx.orderItem.update({
            where: { id: item.id },
            data: { quantity: currentQuantity, weight: weightUpdate, subtotal },
          });
        }

        await adjustAssignedOrderItemLotsInTx(tx, {
          orderId: order.id,
          orderItemId: item.id,
          productId: item.productId,
          existingLots: (item as any).orderItemLots || [],
          previousQty: item.quantity,
          nextQty: currentQuantity,
          sellerId: order.sellerId,
        });

        subtotals.push(subtotal);
      }

      const newTotal = sumIntegerAmounts(subtotals).toNumber();
      const prevTotal = roundToIntegerPeso(order.totalAmount).toNumber();

      const updated = await tx.order.update({
        where: { id: orderId },
        data: {
          totalAmount: newTotal,
          status: OrderStatus.PREPARED,
        },
        include: { items: { include: { product: true } }, persona: true },
      });

      const scaleNote =
        newTotal !== prevTotal
          ? `Total final ajustado por balanza/armado: $${newTotal.toLocaleString('es-AR')}`
          : undefined;

      return { updated, scaleNote };
    }).then(({ updated, scaleNote }) => {
      notifyWebOrderStatusForErpOrder(updated, OrderStatus.PREPARED, scaleNote);
      return updated;
    });
  }
}
