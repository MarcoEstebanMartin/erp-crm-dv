import prisma from '../../utils/prisma';
import { Role, OrderStatus, MovementType } from '@prisma/client';
import { PricingService } from '../pricing.service';
import { logAudit } from '../../utils/audit';
import {
  calculateOrderLine,
  roundToIntegerPeso,
  roundToThreeDecimalsWeight,
  sumIntegerAmounts,
  toDecimal,
} from '../../core/money';

export interface UpdateOrderDto {
  orderId: number;
  userId: number;
  userRole: string;
  items: {
    productId: number;
    quantity: number;
    weight?: number;
    isEmergencyOverride?: boolean;
  }[];
}

export class OrderEditService {
  /**
   * Edita un pedido en estado PENDING (Vendedor o Admin),
   * restaurando stock anterior, recalculando precios con Decimal.js (Pesos Enteros en Origen),
   * congelando Snapshots históricos y sincronizando StockMovements.
   */
  static async updateOrder(data: UpdateOrderDto) {
    const { orderId, userId, userRole, items } = data;

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });

    if (!order) {
      const err: any = new Error('Pedido no encontrado.');
      err.statusCode = 404;
      throw err;
    }

    if (order.status !== OrderStatus.PENDING) {
      throw new Error('Solo se pueden editar pedidos en estado Pendiente.');
    }

    if (userRole === Role.VENDEDOR && order.sellerId !== userId) {
      const err: any = new Error('No podés editar pedidos de otros vendedores.');
      err.statusCode = 403;
      throw err;
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Restaurar stock de los ítems anteriores de manera atómica
      for (const oldItem of order.items) {
        await tx.product.update({
          where: { id: oldItem.productId },
          data: { stock: { increment: oldItem.quantity } },
        });
      }

      const persona = await tx.persona.findUnique({ where: { id: order.personaId } });
      if (!persona) {
        throw new Error('Persona no encontrada.');
      }

      const productIds = items.map((i) => i.productId);
      const dbProducts = await tx.product.findMany({
        where: { id: { in: productIds } },
        include: { rubro: true },
      });

      const dbRules = await tx.discountRule.findMany({
        where: {
          OR: [{ personaId: persona.id }, { priceList: persona.priceList }],
        },
      });

      // 2. Validar y descontar nuevo stock con cálculo exacto Decimal.js y Snapshots
      const orderItemsToCreate: any[] = [];

      for (const item of items) {
        const product = dbProducts.find((p) => p.id === item.productId);
        if (!product) {
          throw new Error(`Producto ID ${item.productId} no encontrado.`);
        }

        const minQty = product.minOrderQuantity || 1;
        if (item.quantity < minQty && !item.isEmergencyOverride) {
          throw new Error(
            `El producto "${product.name}" exige un mínimo de ${minQty} unidades (solicitado: ${item.quantity}).`,
          );
        }

        const pricing = PricingService.calculatePriceAndDiscountInMemory(
          product,
          persona,
          dbRules,
          order.billingType,
        );

        const approxKg = Number((product as any).approximateWeight || 1) || 1;
        const billableQtyDec = product.isPesable
          ? item.weight
            ? roundToThreeDecimalsWeight(item.weight)
            : roundToThreeDecimalsWeight(toDecimal(item.quantity).times(approxKg))
          : toDecimal(item.quantity);

        const lineCalc = calculateOrderLine({
          unitCost: Number((product as any).costPrice || 0),
          unitPriceList: pricing.basePrice,
          billableQty: billableQtyDec,
          discountPct: pricing.discount,
        });

        orderItemsToCreate.push({
          productId: product.id,
          quantity: item.quantity,
          weight: product.isPesable
            ? item.weight
              ? roundToThreeDecimalsWeight(item.weight).toNumber()
              : null
            : null,
          unitPrice: pricing.finalPrice,
          subtotal: lineCalc.lineSubtotal.toNumber(),
          unitCostSnapshot: lineCalc.unitCostSnapshot.toNumber(),
          listPriceSnapshot: lineCalc.listPriceSnapshot.toNumber(),
          discountPctSnapshot: lineCalc.discountPctSnapshot.toNumber(),
        });

        if (process.env.IGNORE_STOCK_CHECK === 'true') {
          await tx.product.update({
            where: { id: product.id },
            data: { stock: { decrement: item.quantity } },
          });
        } else {
          const res = await tx.product.updateMany({
            where: {
              id: product.id,
              stock: { gte: item.quantity },
            },
            data: {
              stock: { decrement: item.quantity },
            },
          });

          if (res.count === 0) {
            throw new Error(
              `Stock insuficiente para "${product.name}" debido a una operación concurrente (Solicitado: ${item.quantity}).`,
            );
          }
        }
      }

      const totalSum = sumIntegerAmounts(orderItemsToCreate.map((i) => i.subtotal)).toNumber();

      // Validar límite de crédito
      const creditLimit = Number(persona.creditLimit || 0);
      const outstandingBalance = roundToIntegerPeso(persona.outstandingBalance || 0).toNumber();
      if (creditLimit > 0 && outstandingBalance + totalSum > creditLimit) {
        if (userRole !== Role.ADMIN) {
          throw new Error(
            `Límite de crédito excedido. Saldo actual: $${outstandingBalance.toLocaleString()}, Disponible: $${(creditLimit - outstandingBalance).toLocaleString()}, Requerido para este pedido: $${totalSum.toLocaleString()}.`,
          );
        }
      }

      // 3. Reemplazar ítems del pedido con sus Snapshots históricos
      await tx.orderItem.deleteMany({ where: { orderId: order.id } });

      const updatedOrder = await tx.order.update({
        where: { id: order.id },
        data: {
          totalAmount: totalSum,
          items: {
            create: orderItemsToCreate,
          },
        },
        include: {
          persona: true,
          items: { include: { product: true } },
        },
      });

      // 4. Sincronizar movimientos de stock para mantener la auditoría consistente
      await tx.stockMovement.deleteMany({
        where: {
          orderId: order.id,
          referenceId: `ORDER-${order.id}`,
        },
      });

      await tx.stockMovement.createMany({
        data: orderItemsToCreate.map((item) => ({
          productId: item.productId,
          quantity: -item.quantity,
          type: MovementType.OUT,
          orderId: order.id,
          referenceId: `ORDER-${order.id}`,
          userId: order.sellerId,
          reason: `Venta - Reserva de Pedido #${order.id} (Modificado)`,
        })),
      });

      return updatedOrder;
    });

    await logAudit({
      userId,
      action: 'UPDATE_ORDER_ITEMS',
      entityType: 'Order',
      entityId: order.id,
      oldValues: { total: order.totalAmount, itemsCount: order.items.length },
      newValues: { total: result.totalAmount, itemsCount: result.items.length },
    });

    return result;
  }
}
