import prisma from '../../utils/prisma';
import { OrderStatus, MovementType } from '@prisma/client';
import {
  roundToIntegerPeso,
  roundToThreeDecimalsWeight,
  sumIntegerAmounts,
  toDecimal,
} from '../../core/money';

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
          'El pedido debe estar pendiente, en preparación o preparado para confirmar el armado.',
        );
      }

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
            await tx.product.update({
              where: { id: item.productId },
              data: { stock: { increment: diff } },
            });

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

        subtotals.push(subtotal);
      }

      const newTotal = sumIntegerAmounts(subtotals).toNumber();

      return await tx.order.update({
        where: { id: orderId },
        data: {
          totalAmount: newTotal,
          status: OrderStatus.PREPARED,
        },
        include: { items: { include: { product: true } }, persona: true },
      });
    });
  }
}
