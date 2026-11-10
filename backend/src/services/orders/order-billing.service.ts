import prisma from '../../utils/prisma';
import { Role, BillingType, InvoiceType, OrderStatus, PaymentMethod } from '@prisma/client';
import { emitirFacturaAFIP } from '../afip.service';
import { logAudit } from '../../utils/audit';
import { roundToIntegerPeso, sumIntegerAmounts } from '../../core/money';
import {
  computeInvoiceTaxBreakdown,
  recordInvoicePerceptions,
  settleOrderFinancials,
} from './order-tax.helpers';
import {
  prepareInvoiceSplitItems,
  reassignSplitStockMovements,
} from './order-billing.helpers';

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
   * emisión AFIP/ARCA o Pre-Factura diferida, congelamiento de Snapshots y Ledger.
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
      include: {
        persona: true,
        items: { include: { product: true } },
      },
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
    const dbProducts = await prisma.product.findMany({
      where: { id: { in: productIds } },
      include: { rubro: true },
    });

    const dbRules = await prisma.discountRule.findMany({
      where: {
        OR: [{ personaId: order.personaId }, { priceList: order.persona.priceList }],
      },
    });

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

    let splitApplied = false;
    let internalOrderTotal = 0;
    if (hasSplit && internoItemsData.length > 0) {
      splitApplied = true;
      internalOrderTotal = sumIntegerAmounts(internoItemsData.map((i) => i.subtotal)).toNumber();
    }
    let officialOrderTotal = sumIntegerAmounts(oficialItemsData.map((i) => i.subtotal)).toNumber();

    // Validar Caja / Banco previo a AFIP
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

    let finalInvoiceNumber: string | null = null;
    let finalCae: string | null = null;
    let finalCaeDueDate: Date | null = null;

    if (billingType === BillingType.OFFICIAL) {
      if (deferCae) {
        finalInvoiceNumber = `PRE-${taxInfo.finalInvoiceType === InvoiceType.FACTURA_A ? 'A' : 'B'}-${order.id.toString().padStart(6, '0')}`;
      } else {
        const afipRes = await emitirFacturaAFIP({
          clientCuit: taxInfo.cuitLimpio,
          clientDocType: taxInfo.docType,
          invoiceType: taxInfo.finalInvoiceType === InvoiceType.FACTURA_A ? 'A' : 'B',
          total: officialOrderTotal,
          neto: taxInfo.isFacturaAOfficial ? taxInfo.net : undefined,
          iva: taxInfo.isFacturaAOfficial ? taxInfo.tax : undefined,
          percepcionAmount: taxInfo.isFacturaAOfficial ? taxInfo.percepIIBB : undefined,
          percepcionIvaAmount: taxInfo.isFacturaAOfficial ? taxInfo.percepIVA : undefined,
        }).catch((err: any) => {
          throw new Error(`Error AFIP al facturar pedido: ${err.message}`);
        });

        finalInvoiceNumber = afipRes.invoiceNumber;
        finalCae = afipRes.cae;
        finalCaeDueDate = afipRes.caeDueDate;
      }
    } else {
      finalInvoiceNumber = `INT-${order.id.toString().padStart(5, '0')}`;
    }

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
      const result = await prisma.$transaction(async (tx) => {
        let internalOrderId: number | null = null;

        if (hasSplit && internoItemsData.length > 0) {
          const internalOrder = await tx.order.create({
            data: {
              personaId: order.personaId,
              sellerId: order.sellerId,
              billingType: BillingType.INTERNAL,
              invoiceType: InvoiceType.PRESUPUESTO,
              invoiceNumber: `INT-${order.id.toString().padStart(5, '0')}-X`,
              totalAmount: internalOrderTotal,
              status: OrderStatus.DELIVERED,
            },
          });
          internalOrderId = internalOrder.id;

          for (const item of internoItemsData) {
            await tx.orderItem.create({
              data: {
                orderId: internalOrder.id,
                productId: item.productId,
                quantity: item.quantity,
                weight: item.weight,
                unitPrice: item.unitPrice,
                subtotal: item.subtotal,
                unitCostSnapshot: item.unitCostSnapshot,
                listPriceSnapshot: item.listPriceSnapshot,
                discountPctSnapshot: item.discountPctSnapshot,
              },
            });
          }

          await settleOrderFinancials(tx, {
            orderId: internalOrder.id,
            personaId: order.personaId,
            adminId,
            billingType: BillingType.INTERNAL,
            paymentMethod,
            amount: internalOrderTotal,
            invoiceTotal: internalOrderTotal,
            invoiceNumber: `INT-${order.id.toString().padStart(5, '0')}-X`,
            description: `Cobro en caja de pedido interno #${internalOrder.id} (Parte Interna de Pedido Original #${order.id})`,
            cashDrawerId: activeDrawerId,
            bankAccountId: selectedBankId,
          });

          await reassignSplitStockMovements(
            tx,
            order.id,
            internalOrder.id,
            order.sellerId,
            internoItemsData,
          );
        }

        for (const item of oficialItemsData) {
          if (item.orderItemId) {
            await tx.orderItem.update({
              where: { id: item.orderItemId },
              data: {
                quantity: item.quantity,
                weight: item.weight,
                unitPrice: item.unitPrice,
                subtotal: item.subtotal,
                unitCostSnapshot: item.unitCostSnapshot,
                listPriceSnapshot: item.listPriceSnapshot,
                discountPctSnapshot: item.discountPctSnapshot,
              },
            });
          }
        }

        if (hasSplit) {
          const oficialItemsIds = oficialItemsData
            .map((o) => o.orderItemId)
            .filter((id) => id !== undefined);
          await tx.orderItem.deleteMany({
            where: { orderId: order.id, id: { notIn: oficialItemsIds } },
          });
        }

        await recordInvoicePerceptions(tx, {
          personaId: order.personaId,
          invoiceNumber: finalInvoiceNumber || `FAC-${order.id}`,
          percepIIBB: taxInfo.percepIIBB,
          percepIVA: taxInfo.percepIVA,
          isFacturaAOfficial: true,
          provinceOrAddress: order.persona.province || order.persona.address,
        });

        await settleOrderFinancials(tx, {
          orderId: order.id,
          personaId: order.personaId,
          adminId,
          billingType,
          paymentMethod,
          amount: officialOrderTotal,
          invoiceTotal: officialOrderTotal,
          invoiceNumber: finalInvoiceNumber,
          description: paymentDescription
            ? `Cobro en caja de pedido #${order.id} - ${paymentDescription}`
            : `Cobro en caja de pedido #${order.id} (Parte Oficial)`,
          cashDrawerId: activeDrawerId,
          bankAccountId: selectedBankId,
        });

        return { split: splitApplied, internalOrderId, internalOrderTotal };
      });

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

      return {
        order: updatedOrderPre,
        split: result.split,
        internalOrderId: result.internalOrderId,
        internalOrderTotal: result.internalOrderTotal,
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

  /**
   * Solicita CAE a AFIP/ARCA para un pedido pre-facturado (flujo diferido IDUO).
   */
  static async requestCaeForOrder(orderId: number) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { persona: true },
    });

    if (!order) {
      const err: any = new Error('Pedido no encontrado.');
      err.statusCode = 404;
      throw err;
    }

    if (order.cae) {
      throw new Error(`Este pedido ya posee CAE asignado (CAE: ${order.cae}).`);
    }

    if (order.billingType !== BillingType.OFFICIAL) {
      throw new Error(
        'Solo se puede solicitar CAE para comprobantes de Sucursal A (Oficial).',
      );
    }

    const cuitLimpio = (order.persona.cuit || '').replace(/\D/g, '');
    const isFacturaA = order.invoiceType === InvoiceType.FACTURA_A;
    const docType = cuitLimpio.length === 11 ? 80 : 96;

    const afipRes = await emitirFacturaAFIP({
      clientCuit: cuitLimpio || '20000000001',
      clientDocType: docType,
      invoiceType: isFacturaA ? 'A' : 'B',
      total: Number(order.totalAmount),
      neto: Number(order.netAmount || 0),
      iva: Number(order.taxAmount || 0),
      percepcionAmount: Number(order.percepcionAmount || 0),
      percepcionIvaAmount: Number(order.percepcionIvaAmount || 0),
    });

    const updated = await prisma.order.update({
      where: { id: order.id },
      data: {
        invoiceNumber: afipRes.invoiceNumber,
        cae: afipRes.cae,
        caeDueDate: afipRes.caeDueDate ? new Date(afipRes.caeDueDate) : null,
      },
      include: { items: { include: { product: true } }, persona: true },
    });

    return {
      updated,
      invoiceNumber: afipRes.invoiceNumber,
      cae: afipRes.cae,
    };
  }
}
