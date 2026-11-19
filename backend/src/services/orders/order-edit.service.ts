import prisma from '../../utils/prisma';
import { Role, OrderStatus, MovementType } from '@prisma/client';
import { PricingService } from '../pricing.service';
import { logAudit } from '../../utils/audit';
import { roundToIntegerPeso } from '../../core/money';
import { type CartBasePricingInfo } from '../../engines/weekly-promos.engine';
import {
  decrementStockByProductMapInTx,
  evaluateOrderCartWithWeeklyPromos,
} from './order-weekly-promos.helper';
import { lockProductsForUpdate } from '../../utils/db-locks.util';

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

    const paidInputItems = (items as any[]).filter((i) => !i?.isPromoBonus);
    if (paidInputItems.length === 0) {
      throw new Error('El pedido debe tener al menos un artículo pago.');
    }

    const result = await prisma.$transaction(async (tx) => {
      if (typeof (tx as any).$queryRaw === 'function') {
        await (tx as any).$queryRaw`SELECT id FROM "Order" WHERE id = ${order.id} FOR UPDATE`;
      }

      const freshOrder =
        typeof (tx.order as any)?.findUnique === 'function'
          ? await tx.order.findUnique({ where: { id: order.id }, include: { items: true } })
          : order;

      if (!freshOrder) {
        const err: any = new Error('Pedido no encontrado.');
        err.statusCode = 404;
        throw err;
      }

      if (freshOrder.status !== OrderStatus.PENDING) {
        throw new Error('Solo se pueden editar pedidos en estado Pendiente.');
      }

      await lockProductsForUpdate(tx, [
        ...freshOrder.items.map((i) => i.productId),
        ...paidInputItems.map((i) => i.productId),
      ]);

      // 1. Restaurar stock de los ítems anteriores de manera atómica (incluye bonificados previos)
      for (const oldItem of freshOrder.items) {
        await tx.product.update({
          where: { id: oldItem.productId },
          data: { stock: { increment: oldItem.quantity } },
        });
      }

      const persona = await tx.persona.findUnique({ where: { id: order.personaId } });
      if (!persona) {
        throw new Error('Persona no encontrada.');
      }

      const productIds = paidInputItems.map((i) => i.productId);
      const dbProducts = await tx.product.findMany({
        where: { id: { in: productIds } },
        include: { rubro: true },
      });

      const dbRules = await tx.discountRule.findMany({
        where: {
          OR: [{ personaId: persona.id }, { priceList: persona.priceList }],
        },
      });

      // 2. Validar mínimos/base y evaluar Ofertas Semanales vigentes con Decimal.js y Snapshots
      const basePricingByProductId = new Map<number, CartBasePricingInfo>();
      const promoInputLines = [];

      for (const item of paidInputItems) {
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

        if (product.stock < item.quantity && process.env.IGNORE_STOCK_CHECK !== 'true') {
          throw new Error(
            `Stock insuficiente para "${product.name}" debido a una operación concurrente (Solicitado: ${item.quantity}).`,
          );
        }

        if (!basePricingByProductId.has(product.id)) {
          const pricing = PricingService.calculatePriceAndDiscountInMemory(
            product,
            persona,
            dbRules,
            order.billingType,
          );
          basePricingByProductId.set(product.id, {
            baseUnitPrice: pricing.finalPrice,
            baseListPrice: pricing.basePrice,
            baseDiscountPct: pricing.discount,
          });
        }

        promoInputLines.push({
          productId: product.id,
          quantity: item.quantity,
          weight: product.isPesable && item.weight ? item.weight : null,
        });
      }

      const evaluated = await evaluateOrderCartWithWeeklyPromos({
        tx,
        items: promoInputLines,
        dbProducts,
        basePricingByProductId,
        ignoreStockCheck: process.env.IGNORE_STOCK_CHECK === 'true',
      });

      await decrementStockByProductMapInTx({
        tx,
        stockRequiredByProduct: evaluated.stockRequiredByProduct,
        dbProducts,
        ignoreStockCheck: process.env.IGNORE_STOCK_CHECK === 'true',
      });

      const totalSum = evaluated.totalAmount;

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

      const orderItemsToCreate = evaluated.lines.map((line) => ({
        productId: line.productId,
        quantity: line.quantity,
        weight: line.weight,
        unitPrice: line.unitPrice,
        subtotal: line.subtotal,
        unitCostSnapshot: line.unitCostSnapshot,
        listPriceSnapshot: line.listPriceSnapshot,
        discountPctSnapshot: line.discountPctSnapshot,
      }));

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
          OR: [
            { referenceId: `ORDER-${order.id}` },
            { referenceId: { startsWith: 'WEB-ORDER-' } },
          ],
        },
      });

      await tx.stockMovement.createMany({
        data: evaluated.lines.map((line) => ({
          productId: line.productId,
          quantity: -line.quantity,
          type: MovementType.OUT,
          orderId: order.id,
          referenceId: `ORDER-${order.id}`,
          userId: order.sellerId,
          reason: line.isPromoBonus
            ? `Bonificación Promo (${line.appliedPromoName || 'Semanal'}) - Pedido #${order.id} (Modificado)`
            : `Venta - Reserva de Pedido #${order.id} (Modificado)`,
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
