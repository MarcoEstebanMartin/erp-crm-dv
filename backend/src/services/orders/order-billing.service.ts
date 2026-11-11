import prisma from '../../utils/prisma';
import { Role, BillingType, OrderStatus, PaymentMethod } from '@prisma/client';
import { logAudit } from '../../utils/audit';
import { roundToIntegerPeso, sumIntegerAmounts } from '../../core/money';
import { computeInvoiceTaxBreakdown } from './order-tax.helpers';
import { prepareInvoiceSplitItems } from './order-billing.helpers';
import {
  executeDeferredCaeRequest,
  resolveAfipCaeOrContingency,
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
}

export class OrderBillingService {
  /**
   * Factura y cobra un pedido armado (PREPARED), soportando Split Billing,
   * emisión AFIP/ARCA o contingencia diferida automática, Snapshots y Ledger.
   */
  static async invoiceOrder(data: InvoiceOrderDto) {
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
      include: { persona: true, items: { include: { product: true } } },
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
    const [dbProducts, dbRules] = await Promise.all([
      prisma.product.findMany({ where: { id: { in: productIds } }, include: { rubro: true } }),
      prisma.discountRule.findMany({
        where: { OR: [{ personaId: order.personaId }, { priceList: order.persona.priceList }] },
      }),
    ]);

    const rubroIds = Array.from(
      new Set(order.items.map((i) => i.product.rubroId).filter((id) => id !== null)),
    ) as number[];
    const splitConfigs = await prisma.splitBillingConfig.findMany({
      where: { personaId: order.personaId, rubroId: { in: rubroIds } },
    });

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

    let activeDrawerId: number | undefined;
    let selectedBankId: number | undefined;

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

      if (!drawer) {
        throw new Error(
          'No hay ninguna Caja de Efectivo abierta. Debe abrir la caja diaria/depósito en el módulo de Cajas antes de facturar un cobro en efectivo.',
        );
      }
      activeDrawerId = drawer.id;
    } else if (paymentMethod === PaymentMethod.BANK_TRANSFER) {
      selectedBankId = reqBankAccountId
        ? Number(reqBankAccountId)
        : (await prisma.bankAccount.findFirst())?.id;
      if (!selectedBankId) {
        throw new Error('No se encontró ninguna cuenta bancaria configurada en el sistema.');
      }
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

    const updatedOrderPre = await prisma.order.update({
      where: { id: order.id },
      data: {
        billingType,
        invoiceType: taxInfo.finalInvoiceType,
        invoiceNumber: finalInvoiceNumber,
        cae: finalCae,
        caeDueDate: finalCaeDueDate ? new Date(finalCaeDueDate) : null,
        totalAmount: officialOrderTotal,
        netAmount: taxInfo.net,
        taxAmount: taxInfo.tax,
        percepcionAmount: taxInfo.percepIIBB,
        percepcionIvaAmount: taxInfo.percepIVA,
        status: OrderStatus.DELIVERED,
      },
      include: { items: { include: { product: true } }, persona: true },
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
          taxInfo,
          activeDrawerId,
          selectedBankId,
        }),
      );

      await logAudit({
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
        order,
        OrderStatus.DELIVERED,
        finalInvoiceNumber ? `Comprobante ${finalInvoiceNumber}` : undefined,
      );

      return {
        order: updatedOrderPre,
        split: result.split,
        internalOrderId: result.internalOrderId,
        internalOrderTotal: result.internalOrderTotal,
        caeQueuedInBackground: shouldEnqueueDeferredCae,
      };
    } catch (secondaryError: any) {
      await prisma.order
        .update({
          where: { id: order.id },
          data: {
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
  }

  static async requestCaeForOrder(orderId: number) {
    return executeDeferredCaeRequest(orderId);
  }
}
