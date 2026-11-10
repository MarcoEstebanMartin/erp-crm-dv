import prisma from '../utils/prisma';
import { Role, BillingType, InvoiceType, OrderStatus, MovementType, SalesChannel } from '@prisma/client';
import { PricingService } from './pricing.service';
import { PersonaService } from './persona.service';
import {
  calculateOrderLine,
  roundToThreeDecimalsWeight,
  sumIntegerAmounts,
  toDecimal,
} from '../core/money';
import { OrderScaleService } from './orders/order-scale.service';

const personaService = new PersonaService();

export interface CreateOrderDto {
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
   * Crea un pedido con Decimal.js (Pesos Enteros en Origen), congela Snapshots históricos
   * (unitCostSnapshot, listPriceSnapshot, discountPctSnapshot), verifica límite de crédito
   * y descuenta stock preventivamente.
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
      const isExactDuplicate = items.every((newItem) =>
        existingRecentOrder.items.some(
          (existingItem) =>
            existingItem.productId === newItem.productId &&
            existingItem.quantity === newItem.quantity,
        ),
      );
      if (isExactDuplicate) {
        return existingRecentOrder;
      }
    }

    return await prisma.$transaction(async (tx) => {
      const productIds = items.map((item) => item.productId);
      const dbProducts = await tx.product.findMany({
        where: { id: { in: productIds } },
        include: { rubro: true },
      });

      const dbRules = await tx.discountRule.findMany({
        where: {
          OR: [{ personaId: persona.id }, { priceList: persona.priceList }],
        },
      });

      const orderItemsToCreate: any[] = [];
      const stockUpdates: { productId: number; newStock: number; quantityDecreased: number }[] = [];

      for (const item of items) {
        const product = dbProducts.find((p) => p.id === item.productId);
        if (!product) {
          throw new Error(`Producto ID ${item.productId} no encontrado.`);
        }

        const minQty = product.minOrderQuantity || 1;
        if (item.quantity < minQty && !item.isEmergencyOverride) {
          throw new Error(
            `El producto "${product.name}" exige un mínimo de ${minQty} unidades (solicitado: ${item.quantity}). Active la excepción por emergencia si requiere facturar menor cantidad.`,
          );
        }

        if (product.stock < item.quantity && process.env.IGNORE_STOCK_CHECK !== 'true') {
          throw new Error(
            `Stock insuficiente para "${product.name}" (Disponible: ${product.stock}, Solicitado: ${item.quantity}).`,
          );
        }

        const pricing = PricingService.calculatePriceAndDiscountInMemory(
          product,
          persona,
          dbRules,
          billingType,
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
          weight: item.weight ? roundToThreeDecimalsWeight(item.weight).toNumber() : null,
          unitPrice: pricing.finalPrice,
          subtotal: lineCalc.lineSubtotal.toNumber(),
          unitCostSnapshot: lineCalc.unitCostSnapshot.toNumber(),
          listPriceSnapshot: lineCalc.listPriceSnapshot.toNumber(),
          discountPctSnapshot: lineCalc.discountPctSnapshot.toNumber(),
        });

        stockUpdates.push({
          productId: product.id,
          newStock: product.stock - item.quantity,
          quantityDecreased: -item.quantity,
        });
      }

      const totalSum = sumIntegerAmounts(orderItemsToCreate.map((i) => i.subtotal)).toNumber();

      const maxUnpaidInvoices = Number(persona.maxUnpaidInvoices || 0);
      if (maxUnpaidInvoices > 0) {
        const pendingInvoicesCount = await personaService.getPersonaPendingInvoicesCount(
          persona.id,
          tx,
        );
        if (pendingInvoicesCount >= maxUnpaidInvoices && userRole !== Role.ADMIN) {
          throw new Error(
            `Límite de cuenta corriente excedido. El cliente debe ${pendingInvoicesCount} boletas, y su límite máximo permitido es de ${maxUnpaidInvoices}.`,
          );
        }
      }

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

      await tx.orderItem.createMany({
        data: orderItemsToCreate.map((oItem) => ({
          orderId: order.id,
          productId: oItem.productId,
          quantity: oItem.quantity,
          weight: oItem.weight,
          unitPrice: oItem.unitPrice,
          subtotal: oItem.subtotal,
          unitCostSnapshot: oItem.unitCostSnapshot,
          listPriceSnapshot: oItem.listPriceSnapshot,
          discountPctSnapshot: oItem.discountPctSnapshot,
        })),
      });

      for (const stockUp of stockUpdates) {
        const qtyToDecrement = Math.abs(stockUp.quantityDecreased);
        if (process.env.IGNORE_STOCK_CHECK === 'true') {
          await tx.product.update({
            where: { id: stockUp.productId },
            data: { stock: { decrement: qtyToDecrement } },
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
            const prod = dbProducts.find((p) => p.id === stockUp.productId);
            throw new Error(
              `Stock insuficiente para "${prod?.name || 'Producto'}" debido a una operación concurrente. Por favor reintente la carga del pedido.`,
            );
          }
        }
      }

      await tx.stockMovement.createMany({
        data: stockUpdates.map((stockUp) => ({
          productId: stockUp.productId,
          quantity: stockUp.quantityDecreased,
          type: MovementType.OUT,
          orderId: order.id,
          referenceId: `ORDER-${order.id}`,
          userId: sellerId,
          reason: `Venta - Reserva de Pedido #${order.id}`,
        })),
      });

      return order;
    });
  }

  static async updateOrderWeights(
    orderId: number,
    itemWeights: { orderItemId: number; weight: number }[],
  ) {
    return OrderScaleService.updateOrderWeights(orderId, itemWeights);
  }

  static async confirmArmado(
    orderId: number,
    itemUpdates: { orderItemId: number; quantity?: number; weight?: number }[],
  ) {
    return OrderScaleService.confirmArmado(orderId, itemUpdates);
  }
}
