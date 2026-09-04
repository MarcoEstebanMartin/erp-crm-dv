import prisma from '../utils/prisma';
import { Role, BillingType, InvoiceType, OrderStatus, MovementType, SalesChannel } from '@prisma/client';
import { PricingService } from './pricing.service';
import { PersonaService } from './persona.service';
import { roundCurrency } from '../utils/math';

const personaService = new PersonaService();

interface CreateOrderDto {
  sellerId: number;
  userRole: string;
  personaId: number;
  billingType?: BillingType;
  salesChannel?: SalesChannel;
  notes?: string;
  items: { productId: number; quantity: number; weight?: number; isEmergencyOverride?: boolean }[];
  idempotencyKey?: string;
}

export class OrderService {
  /**
   * Crea un pedido, verifica el límite de crédito y descuenta stock preventivamente.
   */
  static async createOrder(data: CreateOrderDto) {
    const { sellerId, userRole, personaId, billingType, salesChannel, notes, items } = data;

    const persona = await prisma.persona.findUnique({ where: { id: personaId } });
    if (!persona) {
      throw new Error('Persona no encontrada.');
    }

    if (userRole === Role.VENDEDOR && persona.sellerId !== sellerId) {
      throw new Error('No podés cargar un pedido para un cliente asignado a otro vendedor.');
    }

    // Detección proactiva de duplicados por idempotencia en preventa móvil (últimos 2 minutos)
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
    const existingRecentOrder = await prisma.order.findFirst({
      where: {
        sellerId,
        personaId,
        createdAt: { gte: twoMinutesAgo },
        status: OrderStatus.PENDING,
      },
      include: { items: true },
      orderBy: { createdAt: 'desc' },
    });

    if (existingRecentOrder && existingRecentOrder.items.length === items.length) {
      const isExactDuplicate = items.every(newItem =>
        existingRecentOrder.items.some(
          existingItem =>
            existingItem.productId === newItem.productId &&
            existingItem.quantity === newItem.quantity
        )
      );
      if (isExactDuplicate) {
        console.log(`⚠️ Pedido duplicado detectado por reconexión móvil para cliente ${personaId} (Vendedor #${sellerId}). Devolviendo pedido existente #${existingRecentOrder.id}.`);
        return existingRecentOrder;
      }
    }

    return await prisma.$transaction(async (tx) => {
      const productIds = items.map(item => item.productId);
      
      // 1. Cargar todos los productos involucrados en la transacción en una sola consulta
      const dbProducts = await tx.product.findMany({
        where: { id: { in: productIds } },
        include: { rubro: true }
      });

      // 2. Cargar todas las reglas aplicables en la transacción en una sola consulta
      const dbRules = await tx.discountRule.findMany({
        where: {
          OR: [
            { personaId: persona.id },
            { priceList: persona.priceList }
          ]
        }
      });

      let totalSum = 0;
      const orderItemsToCreate = [];
      const stockUpdates = [];

      for (const item of items) {
        const product = dbProducts.find(p => p.id === item.productId);
        if (!product) {
          throw new Error(`Producto ID ${item.productId} no encontrado.`);
        }

        const minQty = product.minOrderQuantity || 1;
        if (item.quantity < minQty && !item.isEmergencyOverride) {
          throw new Error(
            `El producto "${product.name}" exige un mínimo de ${minQty} unidades (solicitado: ${item.quantity}). Active la excepción por emergencia si requiere facturar menor cantidad.`
          );
        }

        if (product.stock < item.quantity && process.env.IGNORE_STOCK_CHECK !== 'true') {
          throw new Error(
            `Stock insuficiente para "${product.name}" (Disponible: ${product.stock}, Solicitado: ${item.quantity}).`
          );
        }

        // Calcular precio en memoria usando el nuevo método libre de queries N+1
        const pricing = PricingService.calculatePriceAndDiscountInMemory(
          product,
          persona,
          dbRules,
          billingType
        );
        const finalUnitPrice = pricing.finalPrice;
        
        const actualQuantityForPrice = product.isPesable 
          ? (item.weight ? Number(item.weight) : item.quantity * Number((product as any).approximateWeight || 1))
          : item.quantity;
        const subtotal = roundCurrency(finalUnitPrice * actualQuantityForPrice);
        totalSum = roundCurrency(totalSum + subtotal);

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

      const maxUnpaidInvoices = Number(persona.maxUnpaidInvoices || 0);
      if (maxUnpaidInvoices > 0) {
        const pendingInvoicesCount = await personaService.getPersonaPendingInvoicesCount(persona.id, tx);
        
        if (pendingInvoicesCount >= maxUnpaidInvoices) {
          if (userRole !== Role.ADMIN) {
            throw new Error(
              `Límite de cuenta corriente excedido. El cliente debe ${pendingInvoicesCount} boletas, y su límite máximo permitido es de ${maxUnpaidInvoices}.`
            );
          }
        }
      }

      // 3. Crear el pedido
      const order = await tx.order.create({
        data: {
          personaId,
          sellerId,
          billingType: billingType || BillingType.INTERNAL,
          invoiceType: InvoiceType.PRESUPUESTO,
          salesChannel: salesChannel || SalesChannel.MOSTRADOR,
          notes: notes ? notes.trim() : undefined,
          totalAmount: totalSum,
          status: OrderStatus.PENDING,
        },
      });

      // 4. Inserción masiva de ítems del pedido (optimizada en una sola llamada)
      await tx.orderItem.createMany({
        data: orderItemsToCreate.map(oItem => ({
          orderId: order.id,
          productId: oItem.productId,
          quantity: oItem.quantity,
          weight: oItem.weight,
          unitPrice: oItem.unitPrice,
          subtotal: oItem.subtotal,
        }))
      });

      // 5. Actualizar stock general de manera atómica para evitar race conditions
      for (const stockUp of stockUpdates) {
        const qtyToDecrement = Math.abs(stockUp.quantityDecreased);
        if (process.env.IGNORE_STOCK_CHECK === 'true') {
          await tx.product.update({
            where: { id: stockUp.productId },
            data: { stock: { decrement: qtyToDecrement } }
          });
        } else {
          const res = await tx.product.updateMany({
            where: {
              id: stockUp.productId,
              stock: { gte: qtyToDecrement },
            },
            data: {
              stock: { decrement: qtyToDecrement },
            },
          });

          if (res.count === 0) {
            const prod = dbProducts.find(p => p.id === stockUp.productId);
            throw new Error(`Stock insuficiente para "${prod?.name || 'Producto'}" debido a una operación concurrente. Por favor reintente la carga del pedido.`);
          }
        }
      }

      // 6. Inserción masiva de movimientos de stock (optimizada en una sola llamada)
      await tx.stockMovement.createMany({
        data: stockUpdates.map(stockUp => ({
          productId: stockUp.productId,
          quantity: stockUp.quantityDecreased,
          type: MovementType.OUT,
          referenceId: `ORDER-${order.id}`,
          userId: sellerId,
          reason: `Venta - Reserva de Pedido #${order.id}`,
        }))
      });

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
      if (!([OrderStatus.PENDING, OrderStatus.PREPARING, OrderStatus.PREPARED] as OrderStatus[]).includes(order.status as OrderStatus)) {
        throw new Error('Solo se pueden ajustar pesos en pedidos PENDIENTES, EN PREPARACIÓN o PREPARADOS antes de facturar.');
      }

      let newTotal = 0;

      for (const item of order.items) {
        let subtotal = Number(item.subtotal);
        const weightUpdate = itemWeights.find((w) => w.orderItemId === item.id);

        if (item.product.isPesable && weightUpdate && weightUpdate.weight > 0) {
          subtotal = roundCurrency(Number(item.unitPrice) * weightUpdate.weight);
          await tx.orderItem.update({
            where: { id: item.id },
            data: { weight: weightUpdate.weight, subtotal },
          });
        }

        newTotal = roundCurrency(newTotal + subtotal);
      }

      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: { totalAmount: newTotal },
        include: { items: { include: { product: true } }, persona: true },
      });

      return updatedOrder;
    });
  }

  /**
   * Confirma el armado (Picking rápido): Actualiza pesos y/o pone en 0 cantidades (faltantes)
   * y pasa el pedido a PREPARED.
   */
  static async confirmArmado(orderId: number, itemUpdates: { orderItemId: number; quantity?: number; weight?: number }[]) {
    return await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: { items: { include: { product: true } } },
      });

      if (!order) throw new Error('Pedido no encontrado.');
      if (!([OrderStatus.PENDING, OrderStatus.PREPARING, OrderStatus.PREPARED] as OrderStatus[]).includes(order.status as OrderStatus)) {
        throw new Error('El pedido debe estar pendiente, en preparación o preparado para confirmar el armado.');
      }

      let newTotal = 0;

      for (const item of order.items) {
        let currentQuantity = item.quantity;
        let subtotal = Number(item.subtotal);
        let weightUpdate = item.weight ? Number(item.weight) : null;
        const update = itemUpdates.find((u) => u.orderItemId === item.id);

        if (update) {
          if (update.quantity !== undefined) {
            currentQuantity = update.quantity;
          }
          if (update.weight !== undefined) {
            weightUpdate = update.weight;
          }

          if (currentQuantity === 0) {
            subtotal = 0;
            weightUpdate = 0;
          } else {
            if (item.product.isPesable && weightUpdate !== null && weightUpdate > 0) {
              subtotal = roundCurrency(Number(item.unitPrice) * weightUpdate);
            } else {
              subtotal = roundCurrency(Number(item.unitPrice) * currentQuantity);
            }
          }

          // Ajustar stock general si hay cambios en la cantidad
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

        newTotal = roundCurrency(newTotal + subtotal);
      }

      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: { 
          totalAmount: roundCurrency(newTotal),
          status: OrderStatus.PREPARED
        },
        include: { items: { include: { product: true } }, persona: true },
      });

      return updatedOrder;
    });
  }
}
