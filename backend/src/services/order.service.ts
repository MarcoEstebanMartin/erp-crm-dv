import prisma from '../utils/prisma';
import {
  Role,
  BillingType,
  DeliveryMethod,
  InvoiceType,
  OrderStatus,
  MovementType,
  SalesChannel,
} from '@prisma/client';
import { PricingService } from './pricing.service';
import { PersonaService } from './persona.service';
import { OrderScaleService } from './orders/order-scale.service';
import { roundToIntegerPeso } from '../core/money';
import { resolveDefaultDeliveryMethod } from '../engines/delivery-dispatch.engine';
import { reserveStopSlotOnPendingRouteInTx } from './logistics/delivery-route-stops.helper';
import { type CartBasePricingInfo } from '../engines/weekly-promos.engine';
import {
  decrementStockByProductMapInTx,
  evaluateOrderCartWithWeeklyPromos,
  isPromoBonusOrderItem,
} from './orders/order-weekly-promos.helper';

const personaService = new PersonaService();

export interface CreateOrderDto {
  sellerId: number;
  userRole: string;
  personaId: number;
  billingType?: BillingType;
  salesChannel?: SalesChannel;
  deliveryMethod?: DeliveryMethod;
  deliveryRouteId?: number | null;
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

    if (existingRecentOrder) {
      const existingPaidItems = existingRecentOrder.items.filter(
        (existingItem) => !isPromoBonusOrderItem(existingItem),
      );
      if (existingPaidItems.length === items.length) {
        const isExactDuplicate = items.every((newItem) =>
          existingPaidItems.some(
            (existingItem) =>
              existingItem.productId === newItem.productId &&
              existingItem.quantity === newItem.quantity,
          ),
        );
        if (isExactDuplicate) {
          return existingRecentOrder;
        }
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

      const basePricingByProductId = new Map<number, CartBasePricingInfo>();
      const promoInputLines = [];

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

        if (!basePricingByProductId.has(product.id)) {
          const pricing = PricingService.calculatePriceAndDiscountInMemory(
            product,
            persona,
            dbRules,
            billingType,
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

      const totalSum = evaluated.totalAmount;

      const creditLimit = roundToIntegerPeso(persona.creditLimit || 0).toNumber();
      const outstandingBalance = roundToIntegerPeso(persona.outstandingBalance || 0).toNumber();
      if (creditLimit > 0 && outstandingBalance + totalSum > creditLimit && userRole !== Role.ADMIN) {
        throw new Error(
          `Límite de crédito excedido. Saldo actual: $${outstandingBalance.toLocaleString()}, Disponible: $${(creditLimit - outstandingBalance).toLocaleString()}, Requerido: $${totalSum.toLocaleString()}.`,
        );
      }

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

      const resolvedDeliveryMethod = resolveDefaultDeliveryMethod({
        salesChannel,
        isDirectCounterInvoice: false,
        explicitMethod: data.deliveryMethod,
      }) as DeliveryMethod;

      const slot =
        resolvedDeliveryMethod === DeliveryMethod.DELIVERY && data.deliveryRouteId
          ? await reserveStopSlotOnPendingRouteInTx(tx, data.deliveryRouteId)
          : { deliveryRouteId: null, deliverySequence: null };

      const order = await tx.order.create({
        data: {
          personaId,
          sellerId,
          billingType: billingType || BillingType.INTERNAL,
          invoiceType: InvoiceType.PRESUPUESTO,
          salesChannel:
            salesChannel ||
            (resolvedDeliveryMethod === DeliveryMethod.PICKUP
              ? SalesChannel.MOSTRADOR
              : SalesChannel.PREVENTA_RUTA),
          deliveryMethod: resolvedDeliveryMethod,
          deliveryRouteId: slot.deliveryRouteId,
          deliverySequence: slot.deliverySequence,
          notes: notes ? notes.trim() : undefined,
          totalAmount: totalSum,
          status: OrderStatus.PENDING,
        },
      });

      await tx.orderItem.createMany({
        data: evaluated.lines.map((oItem) => ({
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

      await decrementStockByProductMapInTx({
        tx,
        stockRequiredByProduct: evaluated.stockRequiredByProduct,
        dbProducts,
        ignoreStockCheck: process.env.IGNORE_STOCK_CHECK === 'true',
      });

      await tx.stockMovement.createMany({
        data: evaluated.lines.map((line) => ({
          productId: line.productId,
          quantity: -line.quantity,
          type: MovementType.OUT,
          orderId: order.id,
          referenceId: `ORDER-${order.id}`,
          userId: sellerId,
          reason: line.isPromoBonus
            ? `Bonificación Promo (${line.appliedPromoName || 'Semanal'}) - Pedido #${order.id}`
            : `Venta - Reserva de Pedido #${order.id}`,
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
