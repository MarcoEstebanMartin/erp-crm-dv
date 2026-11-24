import prisma from '../utils/prisma';
import {
  Role,
  BillingType,
  DeliveryMethod,
  InvoiceType,
  OrderStatus,
  MovementType,
  PaymentMethod,
  SalesChannel,
} from '@prisma/client';
import { emitirFacturaAFIP } from './afip.service';
import { logAudit } from '../utils/audit';
import { PricingService } from './pricing.service';
import { PersonaService } from './persona.service';
import { lockProductsForUpdate } from '../utils/db-locks.util';
import { resolveDefaultDeliveryMethod } from '../engines/delivery-dispatch.engine';
import { reserveStopSlotOnPendingRouteInTx } from './logistics/delivery-route-stops.helper';
import {
  roundToIntegerPeso,
  roundToThreeDecimalsWeight,
  roundToTwoDecimals,
  toDecimal,
} from '../core/money';
import {
  computeInvoiceTaxBreakdown,
  recordInvoicePerceptions,
  resolveAndSettleOrderPayment,
} from './orders/order-tax.helpers';
import { assignFifoLotsToOrderItem } from './orders/order-billing.helpers';
import { type CartBasePricingInfo } from '../engines/weekly-promos.engine';
import {
  decrementStockByProductMapInTx,
  evaluateOrderCartWithWeeklyPromos,
} from './orders/order-weekly-promos.helper';
import {
  isClientRequestIdUniqueConflict,
  normalizeClientRequestId,
} from '../utils/client-request-id.util';

const personaService = new PersonaService();

export interface CreateDirectInvoiceDto {
  adminId: number;
  userRole: string;
  personaId: number;
  billingType: BillingType;
  salesChannel?: SalesChannel;
  deliveryMethod?: DeliveryMethod;
  deliveryRouteId?: number | null;
  markDelivered?: boolean;
  paymentMethod?: PaymentMethod;
  bankAccountId?: number;
  cashDrawerId?: number;
  checkNumber?: string;
  checkIssuer?: string;
  checkAmount?: number;
  items: {
    productId: number;
    quantity: number;
    weight?: number | null;
  }[];
  idempotencyKey?: string;
}

export class DirectInvoiceService {
  /**
   * Genera una factura directa por mostrador (Oficial AFIP o Interna),
   * descontando stock de lotes FEFO de forma atómica, congelando Snapshots históricos
   * con Decimal.js + PricingService y registrando el cobro o saldo en cuenta corriente.
   */
  static async createDirectInvoice(data: CreateDirectInvoiceDto) {
    const {
      adminId,
      userRole,
      personaId,
      billingType,
      salesChannel,
      paymentMethod,
      bankAccountId,
      cashDrawerId: explicitCashDrawerId,
      checkNumber,
      checkIssuer,
      checkAmount,
      items,
    } = data;

    const clientRequestId = normalizeClientRequestId(data.idempotencyKey);

    // Idempotencia persistente ANTES de consultar/emitir CAE en AFIP
    if (clientRequestId && typeof (prisma as any)?.order?.findUnique === 'function') {
      const existingByKey = await prisma.order.findUnique({
        where: { clientRequestId },
        include: { items: true },
      });
      if (existingByKey) {
        return existingByKey;
      }
    }

    const persona = await prisma.persona.findUnique({ where: { id: personaId } });
    if (!persona) {
      throw new Error('Cliente no encontrado.');
    }

    const productIds = items.map((item) => item.productId);
    const dbProducts = await prisma.product.findMany({
      where: { id: { in: productIds } },
      include: { rubro: true },
    });

    const dbRules =
      typeof (prisma as any)?.discountRule?.findMany === 'function'
        ? await prisma.discountRule.findMany({
            where: { OR: [{ personaId: persona.id }, { priceList: persona.priceList }] },
          })
        : [];

    const basePricingByProductId = new Map<number, CartBasePricingInfo>();
    const promoInputLines = [];

    for (const item of items) {
      const product = dbProducts.find((p) => p.id === item.productId);
      if (!product) {
        throw new Error(`Producto ID ${item.productId} no encontrado.`);
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

      const approxKg = Number((product as any).approximateWeight || 1) || 1;
      const billableQtyDec = product.isPesable
        ? item.weight
          ? roundToThreeDecimalsWeight(item.weight)
          : roundToThreeDecimalsWeight(toDecimal(item.quantity).times(approxKg))
        : toDecimal(item.quantity);

      promoInputLines.push({
        productId: product.id,
        quantity: item.quantity,
        weight: product.isPesable ? billableQtyDec.toNumber() : null,
      });
    }

    const evaluated = await evaluateOrderCartWithWeeklyPromos({
      tx: prisma,
      items: promoInputLines,
      dbProducts,
      basePricingByProductId,
      ignoreStockCheck: process.env.IGNORE_STOCK_CHECK === 'true',
    });

    const orderItemsData = evaluated.lines.map((line) => {
      const prod = dbProducts.find((p) => p.id === line.productId);
      return {
        ...line,
        productName: prod?.name || 'Producto',
      };
    });

    let totalSum = evaluated.totalAmount;

    const creditLimit = Number(persona.creditLimit || 0);
    const outstandingBalance = roundToIntegerPeso(persona.outstandingBalance || 0).toNumber();
    if (creditLimit > 0 && outstandingBalance + totalSum > creditLimit && userRole !== Role.ADMIN) {
      throw new Error(
        `Límite de crédito excedido. Saldo actual: $${outstandingBalance.toLocaleString()}, Disponible: $${(creditLimit - outstandingBalance).toLocaleString()}, Requerido: $${totalSum.toLocaleString()}.`,
      );
    }

    if (!paymentMethod && outstandingBalance > 0 && userRole !== Role.ADMIN) {
      throw new Error(
        `Regla Boleta contra Boleta: El cliente posee una boleta pendiente ($${outstandingBalance.toLocaleString()}). Debe registrar su cobro para poder facturar a crédito.`,
      );
    }

    const maxUnpaidInvoices = Number(persona.maxUnpaidInvoices || 0);
    if (
      !paymentMethod &&
      maxUnpaidInvoices > 0 &&
      userRole !== Role.ADMIN &&
      typeof (prisma as any)?.persona?.findUnique === 'function'
    ) {
      const pendingInvoicesCount = await personaService.getPersonaPendingInvoicesCount(persona.id);
      if (pendingInvoicesCount >= maxUnpaidInvoices) {
        throw new Error(
          `Límite de cuenta corriente excedido. El cliente debe ${pendingInvoicesCount} boletas, y su límite máximo permitido es de ${maxUnpaidInvoices}.`,
        );
      }
    }

    const taxInfo = await computeInvoiceTaxBreakdown(totalSum, billingType, persona);
    totalSum = taxInfo.finalTotal;

    const roundFiscal = (val: number) =>
      taxInfo.isFacturaAOfficial ? roundToTwoDecimals(val).toNumber() : roundToIntegerPeso(val).toNumber();

    let finalInvoiceNumber: string | null = null;
    let finalCae: string | null = null;
    let finalCaeDueDate: Date | null = null;

    // Pre-validar disponibilidad de Caja abierta / Cuenta Bancaria ANTES de emitir CAE en AFIP
    if (paymentMethod === 'CASH' && typeof (prisma as any)?.cashDrawer?.findFirst === 'function') {
      const preDrawer = data.cashDrawerId
        ? await prisma.cashDrawer.findFirst({ where: { id: data.cashDrawerId, status: 'OPEN' } })
        : (await prisma.cashDrawer.findFirst({
            where: {
              status: 'OPEN',
              OR: [{ branch: 'DEPOSITO' }, { drawerType: 'DEPOSITO' }],
            },
            orderBy: { openedAt: 'desc' },
          })) ||
          (await prisma.cashDrawer.findFirst({
            where: { userId: adminId, status: 'OPEN', drawerType: { not: 'CENTRAL' } },
            orderBy: { openedAt: 'desc' },
          })) ||
          (await prisma.cashDrawer.findFirst({
            where: { status: 'OPEN', drawerType: { not: 'CENTRAL' } },
            orderBy: { openedAt: 'desc' },
          }));

      if (!preDrawer) {
        throw new Error(
          'No hay una Caja Oficina abierta. Abrí la Caja Oficina antes de registrar cobros en efectivo.',
        );
      }
    }

    if (
      paymentMethod === 'BANK_TRANSFER' &&
      !bankAccountId &&
      typeof (prisma as any)?.bankAccount?.findFirst === 'function'
    ) {
      const preBank = await prisma.bankAccount.findFirst({ select: { id: true } });
      if (!preBank) {
        throw new Error(
          'No hay cuentas bancarias configuradas para registrar la transferencia.',
        );
      }
    }

    if (billingType === BillingType.OFFICIAL) {
      const afipRes = await emitirFacturaAFIP({
        clientCuit: taxInfo.cuitLimpio,
        clientDocType: taxInfo.docType,
        invoiceType: taxInfo.finalInvoiceType === InvoiceType.FACTURA_A ? 'A' : 'B',
        total: totalSum,
        neto: taxInfo.isFacturaAOfficial ? taxInfo.net : undefined,
        iva: taxInfo.isFacturaAOfficial ? taxInfo.tax : undefined,
        percepcionAmount: taxInfo.isFacturaAOfficial ? taxInfo.percepIIBB : undefined,
        percepcionIvaAmount: taxInfo.isFacturaAOfficial ? taxInfo.percepIVA : undefined,
      }).catch((err: any) => {
        throw new Error(`Error AFIP al emitir factura: ${err.message}`);
      });

      finalInvoiceNumber = afipRes.invoiceNumber;
      finalCae = afipRes.cae;
      finalCaeDueDate = afipRes.caeDueDate;
    }

    const resolvedDeliveryMethod = resolveDefaultDeliveryMethod({
      salesChannel,
      isDirectCounterInvoice: true,
      explicitMethod: data.deliveryMethod,
    }) as DeliveryMethod;
    const isPickup = resolvedDeliveryMethod === DeliveryMethod.PICKUP;

    const fiscalFields = {
      personaId,
      sellerId: adminId,
      status: OrderStatus.DELIVERED,
      billingType,
      salesChannel: salesChannel || SalesChannel.MOSTRADOR,
      deliveryMethod: resolvedDeliveryMethod,
      deliveredAt: isPickup && data.markDelivered !== false ? new Date() : null,
      totalAmount: totalSum,
      netAmount: roundFiscal(taxInfo.net),
      taxAmount: roundFiscal(taxInfo.tax),
      percepcionAmount: roundFiscal(taxInfo.percepIIBB),
      percepcionIvaAmount: roundFiscal(taxInfo.percepIVA),
      invoiceType: taxInfo.finalInvoiceType,
      cae: finalCae,
      caeDueDate: finalCaeDueDate ? new Date(finalCaeDueDate) : null,
      invoiceNumber: finalInvoiceNumber,
      invoicedAt: new Date(),
    };

    try {
      const result = await prisma.$transaction(async (tx) => {
        await lockProductsForUpdate(tx, Array.from(new Set(productIds)));

        await decrementStockByProductMapInTx({
          tx,
          stockRequiredByProduct: evaluated.stockRequiredByProduct,
          dbProducts,
          ignoreStockCheck: process.env.IGNORE_STOCK_CHECK === 'true',
          formatConcurrentError: (prodName) =>
            `Stock insuficiente para "${prodName}" debido a una operación concurrente. Por favor reintente la venta.`,
        });

        const slot =
          !isPickup && data.deliveryRouteId
            ? await reserveStopSlotOnPendingRouteInTx(tx, data.deliveryRouteId)
            : { deliveryRouteId: null, deliverySequence: null };

        let order = await tx.order.create({
          data: {
            ...fiscalFields,
            ...(clientRequestId ? { clientRequestId } : {}),
            deliveryRouteId: slot.deliveryRouteId,
            deliverySequence: slot.deliverySequence,
          },
        });
        let resolvedInvoiceNumber = finalInvoiceNumber;
        if (!resolvedInvoiceNumber) {
          resolvedInvoiceNumber = `INT-${order.id.toString().padStart(5, '0')}`;
          order = await tx.order.update({
            where: { id: order.id },
            data: { invoiceNumber: resolvedInvoiceNumber },
          });
        }

        for (const itemData of orderItemsData) {
          const orderItem = await tx.orderItem.create({
            data: {
              orderId: order.id,
              productId: itemData.productId,
              quantity: itemData.quantity,
              weight: itemData.weight,
              unitPrice: itemData.unitPrice,
              subtotal: itemData.subtotal,
              unitCostSnapshot: itemData.unitCostSnapshot,
              listPriceSnapshot: itemData.listPriceSnapshot,
              discountPctSnapshot: itemData.discountPctSnapshot,
            },
          });

          const allocatedLots = await assignFifoLotsToOrderItem(
            tx,
            orderItem.id,
            itemData.productId,
            itemData.quantity,
          );

          const movReason = itemData.isPromoBonus
            ? `Bonificación Promo (${itemData.appliedPromoName || 'Semanal'}) comprobante ${resolvedInvoiceNumber}`
            : `Venta directa comprobante ${resolvedInvoiceNumber}`;

          if (allocatedLots.length > 0) {
            for (const alloc of allocatedLots) {
              await tx.stockMovement.create({
                data: {
                  productId: itemData.productId,
                  quantity: -alloc.quantity,
                  type: MovementType.OUT,
                  orderId: order.id,
                  referenceId: `FAC-${order.id}`,
                  userId: adminId,
                  reason: movReason,
                  productLotId: alloc.productLotId,
                },
              });
            }
          } else {
            await tx.stockMovement.create({
              data: {
                productId: itemData.productId,
                quantity: -itemData.quantity,
                type: MovementType.OUT,
                orderId: order.id,
                referenceId: `FAC-${order.id}`,
                userId: adminId,
                reason: movReason,
              },
            });
          }
        }

        await recordInvoicePerceptions(tx, {
          personaId,
          invoiceNumber: resolvedInvoiceNumber || `FAC-${order.id}`,
          percepIIBB: taxInfo.percepIIBB,
          percepIVA: taxInfo.percepIVA,
          isFacturaAOfficial: taxInfo.isFacturaAOfficial,
          provinceOrAddress: persona.province || persona.address,
        });

        await resolveAndSettleOrderPayment(tx, {
          orderId: order.id,
          personaId,
          adminId,
          userRole,
          billingType,
          paymentMethod,
          bankAccountId,
          explicitCashDrawerId,
          checkNumber,
          checkIssuer,
          checkAmount,
          totalSum,
          invoiceNumber: resolvedInvoiceNumber,
        });

        return await tx.order.findUnique({
          where: { id: order.id },
          include: {
            persona: true,
            items: { include: { product: true, orderItemLots: true } },
          },
        });
      });

      await logAudit({
        userId: adminId,
        action: 'CREATE_DIRECT_INVOICE',
        entityType: 'Order',
        entityId: result!.id,
        newValues: {
          billingType,
          invoiceNumber: result?.invoiceNumber,
          cae: finalCae,
          total: totalSum,
        },
      });

      return result;
    } catch (secondaryError: any) {
      if (
        clientRequestId &&
        isClientRequestIdUniqueConflict(secondaryError) &&
        typeof (prisma as any)?.order?.findUnique === 'function'
      ) {
        const concurrentOrder = await prisma.order.findUnique({
          where: { clientRequestId },
          include: { items: true },
        });
        if (concurrentOrder) {
          return concurrentOrder;
        }
      }

      if (!finalCae) {
        throw secondaryError;
      }

      await prisma.order
        .create({
          data: {
            ...fiscalFields,
            notes: `[ALERTA AFIP] CAE ${finalCae} emitido pero falló imputación de stock/caja: ${secondaryError.message}. Conciliar manualmente.`,
          },
        })
        .catch(() => {});

      throw new Error(
        `La factura oficial fue emitida con éxito (Nro: ${finalInvoiceNumber}, CAE: ${finalCae}). Sin embargo, ocurrió un error al registrar las transacciones financieras o el stock de lotes: ${secondaryError.message}. El comprobante fue registrado con una alerta contable para su conciliación manual.`,
      );
    }
  }
}
