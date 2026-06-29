import prisma from '../utils/prisma';
import { Role, BillingType, InvoiceType, OrderStatus, MovementType } from '@prisma/client';

interface CreateOrderDto {
  sellerId: number;
  userRole: string;
  personaId: number;
  items: { productId: number; quantity: number; weight?: number }[];
}

export class OrderService {
  /**
   * Crea un pedido, verifica el límite de crédito y descuenta stock preventivamente.
   */
  static async createOrder(data: CreateOrderDto) {
    const { sellerId, userRole, personaId, items } = data;

    const persona = await prisma.persona.findUnique({ where: { id: personaId } });
    if (!persona) {
      throw new Error('Persona no encontrada.');
    }

    if (userRole === Role.VENDEDOR && persona.sellerId !== sellerId) {
      throw new Error('No podés cargar un pedido para un cliente asignado a otro vendedor.');
    }

    return await prisma.$transaction(async (tx) => {
      let totalSum = 0;
      const orderItemsToCreate = [];
      const stockUpdates = [];

      for (const item of items) {
        const product = await tx.product.findUnique({
          where: { id: item.productId },
        });

        if (!product) {
          throw new Error(`Producto ID ${item.productId} no encontrado.`);
        }

        if (product.stock < item.quantity) {
          throw new Error(
            `Stock insuficiente para "${product.name}" (Disponible: ${product.stock}, Solicitado: ${item.quantity}).`
          );
        }

        let selectedPrice = Number(product.listPrice);
        let itemDiscount = Number(persona.discount || 0);

        if (persona.priceList === 'B') {
          const isMelincue = product.description?.toUpperCase() === 'MELINCUE' || product.name?.toUpperCase().includes('MELINCUE');
          if (isMelincue) {
            itemDiscount = 3;
          } else {
            itemDiscount = 0;
          }
        }

        const finalUnitPrice = selectedPrice * (1 - itemDiscount / 100);
        // Si es pesable y tiene peso explícito lo usa, si no, usa quantity * approximateWeight, si no tiene aprox, asume 1kg por unidad.
        const actualQuantityForPrice = product.isPesable 
          ? (item.weight ? item.weight : item.quantity * Number((product as any).approximateWeight || 1))
          : item.quantity;
        const subtotal = finalUnitPrice * actualQuantityForPrice;
        totalSum += subtotal;

        orderItemsToCreate.push({
          productId: product.id,
          quantity: item.quantity,
          weight: item.weight || null,
          unitPrice: finalUnitPrice,
          subtotal: subtotal,
        });

        stockUpdates.push({
          productId: product.id,
          newStock: product.stock - item.quantity,
          quantityDecreased: -item.quantity,
        });
      }

      const creditLimit = Number(persona.creditLimit || 0);
      const outstandingBalance = Number(persona.outstandingBalance || 0);
      if (creditLimit > 0 && (outstandingBalance + totalSum) > creditLimit) {
        if (userRole !== Role.ADMIN) {
          throw new Error(
            `Límite de crédito excedido. Saldo actual: $${outstandingBalance.toLocaleString()}, Disponible: $${(creditLimit - outstandingBalance).toLocaleString()}, Requerido para este pedido: $${totalSum.toLocaleString()}.`
          );
        }
      }

      const order = await tx.order.create({
        data: {
          personaId,
          sellerId,
          billingType: BillingType.INTERNAL,
          invoiceType: InvoiceType.PRESUPUESTO,
          totalAmount: totalSum,
          status: OrderStatus.PENDING,
        },
      });

      for (const oItem of orderItemsToCreate) {
        await tx.orderItem.create({
          data: {
            orderId: order.id,
            productId: oItem.productId,
            quantity: oItem.quantity,
            weight: oItem.weight,
            unitPrice: oItem.unitPrice,
            subtotal: oItem.subtotal,
          },
        });
      }

      for (const stockUp of stockUpdates) {
        await tx.product.update({
          where: { id: stockUp.productId },
          data: { stock: stockUp.newStock },
        });

        await tx.stockMovement.create({
          data: {
            productId: stockUp.productId,
            quantity: stockUp.quantityDecreased,
            type: MovementType.OUT,
            referenceId: `ORDER-${order.id}`,
            userId: sellerId,
            reason: `Venta - Reserva de Pedido #${order.id}`,
          },
        });
      }

      return order;
    });
  }

  /**
   * Actualiza los pesos exactos de los productos pesables antes de facturar
   * y recalcula los subtotales y el total del pedido.
   */
  static async updateOrderWeights(orderId: number, itemWeights: { orderItemId: number; weight: number }[]) {
    return await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: { items: { include: { product: true } } },
      });

      if (!order) throw new Error('Pedido no encontrado.');
      if (order.status !== OrderStatus.PREPARED) {
        throw new Error('Solo se pueden ajustar pesos en pedidos PREPARADOS antes de facturar.');
      }

      let newTotal = 0;

      for (const item of order.items) {
        let subtotal = Number(item.subtotal);
        const weightUpdate = itemWeights.find((w) => w.orderItemId === item.id);

        if (item.product.isPesable && weightUpdate && weightUpdate.weight > 0) {
          subtotal = Number(item.unitPrice) * weightUpdate.weight;
          await tx.orderItem.update({
            where: { id: item.id },
            data: { weight: weightUpdate.weight, subtotal },
          });
        }

        newTotal += subtotal;
      }

      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: { totalAmount: newTotal },
        include: { items: { include: { product: true } }, persona: true },
      });

      return updatedOrder;
    });
  }
}
