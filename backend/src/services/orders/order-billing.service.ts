import prisma from '../../utils/prisma';
import { Role, BillingType, DeliveryMethod, OrderStatus, PaymentMethod } from '@prisma/client';
import { logAudit } from '../../utils/audit';
import { roundToIntegerPeso, roundToTwoDecimals, sumIntegerAmounts } from '../../core/money';
import { computeInvoiceTaxBreakdown } from './order-tax.helpers';
import { prepareInvoiceSplitItems } from './order-billing.helpers';
import {
  executeDeferredCaeRequest,
  resolveAfipCaeOrContingency,
  withOrderBillingLock,
} from './order-cae-deferred.helper';
import { executeInvoiceOrderSettlementTx } from './order-invoice-tx.helper';
import { enqueueDeferredAfipCaeRetry } from '../resilience/external-integrations-retry.service';
import { notifyWebOrderStatusForErpOrder } from './web-order-status-bridge.service';

export interface InvoiceOrderDto {
  orderId: number;
  adminId: number;
  userRole: string;
  billingType: BillingType;
  paymentMethod?: PaymentMethod;
  paymentDescription?: string;
  bankAccountId?: number;
  deferCae?: boolean;
  deliveryMethod?: DeliveryMethod;
  markPickedUp?: boolean;
}

export class OrderBillingService {
  /**
   * Factura y cobra un pedido armado (PREPARED), soportando Split Billing,
   * emisión AFIP/ARCA o contingencia diferida automática, Snapshots y Ledger.
   */
  static async invoiceOrder(data: InvoiceOrderDto) {
    return withOrderBillingLock(data.orderId, async () => {
      const {
        orderId,
        adminId,
        userRole,
        billingType,
        paymentMethod,
        paymentDescription,
        bankAccountId: reqBankAccountId,
        deferCae,
      } = data;

      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: { persona: true, items: { include: { product: true, orderItemLots: true } } },
      });

      if (!order) {
        const err: any = new Error('Pedido no encontrado.');
        err.statusCode = 404;
        throw err;
      }

      if (order.status !== OrderStatus.PREPARED) {
        throw new Error(
          `No se puede facturar. El pedido debe estar armado por depósito primero (Estado actual: ${order.status}).`,
        );
      }

      const outstandingBalance = roundToIntegerPeso(order.persona.outstandingBalance || 0).toNumber();
      if (!paymentMethod && outstandingBalance > 0 && userRole !== Role.ADMIN) {
        throw new Error(
          `Regla Boleta contra Boleta: El cliente posee una boleta pendiente ($${outstandingBalance.toLocaleString()}). Debe registrar su cobro para poder facturar este pedido a crédito.`,
        );
      }

      const productIds = order.items.map((item) => item.productId);
      const rubroIds = Array.from(
        new Set(order.items.map((i) => i.product.rubroId).filter((id) => id !== null)),
      ) as number[];

      const resolvePaymentDestination = async (): Promise<{
        activeDrawerId?: number;
        selectedBankId?: number;
      }> => {
        if (paymentMethod === PaymentMethod.CASH) {
          const drawer =
            (await prisma.cashDrawer.findFirst({
              where: { userId: adminId, status: 'OPEN' },
              orderBy: { openedAt: 'desc' },
            })) ||
            (await prisma.cashDrawer.findFirst({
              where: { status: 'OPEN' },
              orderBy: { openedAt: 'desc' },
            }));
          return { activeDrawerId: drawer?.id };
        }
        if (paymentMethod === PaymentMethod.BANK_TRANSFER) {
          const bankId = reqBankAccountId
            ? Number(reqBankAccountId)
            : (await prisma.bankAccount.findFirst())?.id;
          return { selectedBankId: bankId };
        }
        return {};
      };

      const [dbProducts, dbRules, splitConfigs, paymentDest] = await Promise.all([
        prisma.product.findMany({ where: { id: { in: productIds } }, include: { rubro: true } }),
        prisma.discountRule.findMany({
          where: { OR: [{ personaId: order.personaId }, { priceList: order.persona.priceList }] },
        }),
        prisma.splitBillingConfig.findMany({
          where: { personaId: order.personaId, rubroId: { in: rubroIds } },
        }),
        resolvePaymentDestination(),
      ]);

      const { hasSplit, oficialItemsData, internoItemsData } = prepareInvoiceSplitItems({
        orderItems: order.items,
        dbProducts,
        persona: order.persona,
        dbRules,
        splitConfigs,
        billingType,
      });

      const splitApplied = hasSplit && internoItemsData.length > 0;
      const internalOrderTotal = splitApplied
        ? sumIntegerAmounts(internoItemsData.map((i) => i.subtotal)).toNumber()
        : 0;
      let officialOrderTotal = sumIntegerAmounts(oficialItemsData.map((i) => i.subtotal)).toNumber();

      const { activeDrawerId, selectedBankId } = paymentDest;

      if (paymentMethod === PaymentMethod.CASH && !activeDrawerId) {
        throw new Error(
          'No hay ninguna Caja de Efectivo abierta. Debe abrir la caja diaria/depósito en el módulo de Cajas antes de facturar un cobro en efectivo.',
        );
      }
      if (paymentMethod === PaymentMethod.BANK_TRANSFER && !selectedBankId) {
        throw new Error('No se encontró ninguna cuenta bancaria configurada en el sistema.');
      }

      const taxInfo = await computeInvoiceTaxBreakdown(officialOrderTotal, billingType, order.persona);
      officialOrderTotal = taxInfo.finalTotal;

      const {
        finalInvoiceNumber,
        finalCae,
        finalCaeDueDate,
        shouldEnqueueDeferredCae,
      } = await resolveAfipCaeOrContingency({
        orderId: order.id,
        billingType,
        deferCae,
        finalInvoiceType: taxInfo.finalInvoiceType,
        cuitLimpio: taxInfo.cuitLimpio,
        docType: taxInfo.docType,
        officialOrderTotal,
        isFacturaAOfficial: taxInfo.isFacturaAOfficial,
        net: taxInfo.net,
        tax: taxInfo.tax,
        percepIIBB: taxInfo.percepIIBB,
        percepIVA: taxInfo.percepIVA,
      });

      try {
        const result = await prisma.$transaction((tx) =>
          executeInvoiceOrderSettlementTx(tx, {
            order,
            adminId,
            billingType,
            paymentMethod,
            paymentDescription,
            splitApplied,
            hasSplit,
            internoItemsData,
            oficialItemsData,
            internalOrderTotal,
            officialOrderTotal,
            finalInvoiceNumber,
            finalCae,
            finalCaeDueDate,
            taxInfo,
            activeDrawerId,
            selectedBankId,
            deliveryMethod: data.deliveryMethod,
            markPickedUp: data.markPickedUp,
          }),
        );

        void logAudit({
          userId: adminId,
          action: 'INVOICE_ORDER',
          entityType: 'Order',
          entityId: order.id,
          newValues: {
            billingType,
            invoiceNumber: finalInvoiceNumber,
            cae: finalCae,
            total: officialOrderTotal,
            split: result.split,
            internalOrderId: result.internalOrderId,
          },
        });

        if (shouldEnqueueDeferredCae) {
          enqueueDeferredAfipCaeRetry(order.id, () =>
            OrderBillingService.requestCaeForOrder(order.id),
          );
        }

        notifyWebOrderStatusForErpOrder(
          result.updatedOrder,
          OrderStatus.DELIVERED,
          finalInvoiceNumber ? `Comprobante ${finalInvoiceNumber}` : undefined,
        );

        return {
          order: result.updatedOrder,
          split: result.split,
          internalOrderId: result.internalOrderId,
          internalOrderTotal: result.internalOrderTotal,
          caeQueuedInBackground: shouldEnqueueDeferredCae,
        };
      } catch (secondaryError: any) {
        if (!finalCae) {
          throw secondaryError;
        }

        const roundFiscal = (v: number) =>
          taxInfo.isFacturaAOfficial ? roundToTwoDecimals(v).toNumber() : roundToIntegerPeso(v).toNumber();

        await prisma.order
          .update({
            where: { id: order.id },
            data: {
              billingType,
              invoiceType: taxInfo.finalInvoiceType,
              invoiceNumber: finalInvoiceNumber,
              invoicedAt: new Date(),
              cae: finalCae,
              caeDueDate: finalCaeDueDate ? new Date(finalCaeDueDate) : null,
              totalAmount: officialOrderTotal,
              netAmount: roundFiscal(taxInfo.net),
              taxAmount: roundFiscal(taxInfo.tax),
              percepcionAmount: roundFiscal(taxInfo.percepIIBB),
              percepcionIvaAmount: roundFiscal(taxInfo.percepIVA),
              status: OrderStatus.DELIVERED,
              notes:
                (order.notes ? order.notes + ' | ' : '') +
                `[ALERTA AFIP] CAE ${finalCae} emitido pero falló registro financiero: ${secondaryError.message}. Conciliar manualmente.`,
            },
          })
          .catch(() => {});

        throw new Error(
          `La factura oficial de AFIP fue emitida con éxito (Nro: ${finalInvoiceNumber}, CAE: ${finalCae}). Sin embargo, ocurrió un error al registrar las transacciones financieras o la porción interna: ${secondaryError.message}. El pedido fue marcado con una alerta contable para su conciliación manual.`,
        );
      }
    });
  }

  static async requestCaeForOrder(orderId: number) {
    return executeDeferredCaeRequest(orderId);
  }
}
