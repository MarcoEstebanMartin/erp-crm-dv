import { BillingType, InvoiceType, MovementType, OrderStatus, SalesChannel } from '@prisma/client';
import prisma from '../../utils/prisma';
import { PricingService } from '../pricing.service';
import {
  calculateAfipBreakdown,
  calculateOrderLine,
  roundToIntegerPeso,
  roundToThreeDecimalsWeight,
  roundToTwoDecimals,
  sumIntegerAmounts,
  toDecimal,
} from '../../core/money';
import { getTiendaOnlineUser } from './store-auth.service';

export interface StoreOrderItemInput {
  productId: number;
  quantity: number;
  isEmergencyOverride?: boolean;
}

/**
 * Resuelve el precio unitario oficial en servidor para Tienda Mayorista:
 * 1. Si existe una oferta activa en OfferCampaignItem > 0, usa ese precio entero de oferta (sin descuento adicional).
 * 2. De lo contrario, aplica la lista del cliente y reglas de descuento con PricingService.
 * Prohibido aceptar precios enviados desde el navegador.
 */
export function resolveServerSideStorePricing(
  product: any,
  client: any,
  dbRules: any[],
  activeOfferPrice?: number | null,
): { basePrice: number; discountPct: number; finalUnitPrice: number } {
  if (activeOfferPrice !== undefined && activeOfferPrice !== null && activeOfferPrice > 0) {
    const offerInt = roundToIntegerPeso(activeOfferPrice).toNumber();
    return {
      basePrice: offerInt,
      discountPct: 0,
      finalUnitPrice: offerInt,
    };
  }

  const pricing = PricingService.calculatePriceAndDiscountInMemory(
    product,
    client,
    dbRules,
    BillingType.INTERNAL,
  );

  return {
    basePrice: roundToIntegerPeso(pricing.basePrice).toNumber(),
    discountPct: roundToTwoDecimals(pricing.discount).toNumber(),
    finalUnitPrice: roundToTwoDecimals(pricing.finalPrice).toNumber(),
  };
}

export class StoreOrderService {
  static async getClientAccountSummary(personaId: number) {
    const client = await prisma.persona.findUnique({
      where: { id: personaId },
      include: {
        orders: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            movementId: true,
            status: true,
            totalAmount: true,
            createdAt: true,
            invoiceType: true,
            invoiceNumber: true,
          },
        },
      },
    });

    if (!client || !client.isClient) {
      return null;
    }

    return {
      client: {
        id: client.id,
        name: client.name,
        cuit: client.cuit,
        address: client.address,
        city: client.city,
        outstandingBalance: roundToTwoDecimals(client.outstandingBalance || 0).toNumber(),
        creditLimit: roundToTwoDecimals(client.creditLimit || 0).toNumber(),
        priceList: client.priceList || 'A',
        discount: roundToTwoDecimals(client.discount || 0).toNumber(),
      },
      recentOrders: client.orders,
    };
  }

  static async getClientOrdersHistory(personaId: number) {
    return prisma.order.findMany({
      where: { personaId },
      orderBy: { createdAt: 'desc' },
      include: {
        items: {
          include: {
            product: { select: { id: true, name: true, sku: true, imageUrl: true } },
          },
        },
      },
    });
  }

  static async createStoreOrder(input: {
    personaId: number;
    items: StoreOrderItemInput[];
    notes?: string | null;
  }) {
    const client = await prisma.persona.findUnique({
      where: { id: input.personaId },
    });

    if (!client || !client.isActive || !client.isClient) {
      const err: any = new Error('Cliente no encontrado o inactivo.');
      err.statusCode = 404;
      throw err;
    }

    const tiendaUser = await getTiendaOnlineUser();

    return prisma.$transaction(async (tx) => {
      const productIds = input.items.map((i) => i.productId);
      const [dbProducts, dbRules] = await Promise.all([
        tx.product.findMany({
          where: { id: { in: productIds }, isActive: true },
          include: {
            rubro: true,
            offerCampaignItems: {
              include: { campaign: { select: { isActive: true } } },
            },
          },
        }),
        tx.discountRule.findMany({
          where: { OR: [{ personaId: client.id }, { priceList: client.priceList }] },
        }),
      ]);

      const orderItemsToCreate: any[] = [];
      const stockUpdates: { productId: number; qtyToDecrement: number; productName: string }[] = [];
      let totalBultos = 0;

      for (const reqItem of input.items) {
        const product = dbProducts.find((p) => p.id === reqItem.productId);
        if (!product) {
          throw new Error(`El artículo solicitado (ID ${reqItem.productId}) no está disponible.`);
        }

        const qty = Math.max(1, Math.trunc(reqItem.quantity));
        const minQty = product.minOrderQuantity || 1;
        if (qty < minQty && !reqItem.isEmergencyOverride) {
          throw new Error(
            `El producto "${product.name}" exige un mínimo de ${minQty} unidades.`,
          );
        }

        if (product.stock < qty && process.env.IGNORE_STOCK_CHECK !== 'true') {
          throw new Error(
            `Stock insuficiente para "${product.name}" (Disponible: ${product.stock}, Solicitado: ${qty}).`,
          );
        }

        const activeOffer = product.offerCampaignItems.find(
          (oci) => oci.campaign && oci.campaign.isActive,
        );
        const resolvedPricing = resolveServerSideStorePricing(
          product,
          client,
          dbRules,
          activeOffer ? Number(activeOffer.offerPrice) : null,
        );

        const approxKg = Number(product.approximateWeight || 1) || 1;
        const billableQty = product.isPesable
          ? roundToThreeDecimalsWeight(toDecimal(qty).times(approxKg))
          : toDecimal(qty);

        const lineCalc = calculateOrderLine({
          unitCost: Number(product.costPrice || 0),
          unitPriceList: resolvedPricing.basePrice,
          billableQty,
          discountPct: resolvedPricing.discountPct,
        });

        totalBultos += Math.ceil(qty / Math.max(1, product.unitsPerBox || 1));

        orderItemsToCreate.push({
          productId: product.id,
          quantity: qty,
          weight: null,
          unitPrice: lineCalc.netUnitPrice.toNumber(),
          subtotal: lineCalc.lineSubtotal.toNumber(),
          unitCostSnapshot: lineCalc.unitCostSnapshot.toNumber(),
          listPriceSnapshot: lineCalc.listPriceSnapshot.toNumber(),
          discountPctSnapshot: lineCalc.discountPctSnapshot.toNumber(),
        });

        stockUpdates.push({
          productId: product.id,
          qtyToDecrement: qty,
          productName: product.name,
        });
      }

      if (orderItemsToCreate.length === 0) {
        throw new Error('Los productos seleccionados no son válidos.');
      }

      const totalInteger = sumIntegerAmounts(orderItemsToCreate.map((i) => i.subtotal));
      const afipBreakdown = calculateAfipBreakdown(totalInteger, 21, 0);

      const newOrder = await tx.order.create({
        data: {
          personaId: client.id,
          sellerId: tiendaUser.id,
          billingType: BillingType.INTERNAL,
          invoiceType: InvoiceType.PRESUPUESTO,
          salesChannel: SalesChannel.TIENDA_WEB,
          status: OrderStatus.PENDING,
          netAmount: afipBreakdown.netAmount.toNumber(),
          taxAmount: afipBreakdown.ivaAmount.toNumber(),
          totalAmount: totalInteger.toNumber(),
          notes: input.notes ? String(input.notes).trim() : null,
          bultosCount: totalBultos,
          bultosDetails: {
            notes: input.notes ? String(input.notes).trim() : '',
            channel: 'Tienda Online',
            isWebOrder: true,
            clientName: client.name,
            createdFromWeb: new Date().toISOString(),
          },
          items: {
            create: orderItemsToCreate,
          },
        },
        include: {
          persona: { select: { id: true, name: true, cuit: true } },
          items: { include: { product: { select: { name: true, sku: true } } } },
        },
      });

      for (const stockUp of stockUpdates) {
        if (process.env.IGNORE_STOCK_CHECK === 'true') {
          await tx.product.update({
            where: { id: stockUp.productId },
            data: { stock: { decrement: stockUp.qtyToDecrement } },
          });
        } else {
          const updated = await tx.product.updateMany({
            where: { id: stockUp.productId, stock: { gte: stockUp.qtyToDecrement } },
            data: { stock: { decrement: stockUp.qtyToDecrement } },
          });
          if (updated.count === 0) {
            throw new Error(
              `Stock insuficiente para "${stockUp.productName}" por venta simultánea. Reintentá la compra.`,
            );
          }
        }
      }

      await tx.stockMovement.createMany({
        data: stockUpdates.map((stockUp) => ({
          productId: stockUp.productId,
          quantity: -stockUp.qtyToDecrement,
          type: MovementType.OUT,
          orderId: newOrder.id,
          referenceId: `ORDER-${newOrder.id}`,
          userId: tiendaUser.id,
          reason: `Venta Tienda Web - Reserva de Pedido #${newOrder.id}`,
        })),
      });

      return newOrder;
    });
  }
}
