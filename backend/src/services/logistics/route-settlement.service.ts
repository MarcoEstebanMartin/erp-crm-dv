import {
  BillingType, InvoiceType, LedgerEntryType, LedgerSourceType,
  OrderStatus, PaymentMethod, TransactionType,
} from '@prisma/client';
import prisma from '../../utils/prisma';
import AppError from '../../utils/AppError';
import { logAudit } from '../../utils/audit';
import { roundToIntegerPeso } from '../../core/money';
import {
  evaluateRouteSettlementActions,
  type RouteFieldReceiptInput,
} from '../../engines/route-settlement.engine';
import {
  computeInvoiceTaxBreakdown,
  recordInvoicePerceptions,
} from '../orders/order-tax.helpers';
import {
  executeDeferredCaeRequest,
  resolveAfipCaeOrContingency,
} from '../orders/order-cae-deferred.helper';
import { enqueueDeferredAfipCaeRetry } from '../resilience/external-integrations-retry.service';
import { recordLedgerMovement } from '../ledger/account-ledger.service';
import { notifyWebOrderStatusForErpOrder } from '../orders/web-order-status-bridge.service';
import { generateUniqueVerificationCode } from '../../core/receiptToken';
import { paymentAllocationService } from '../finance/payment-allocation.service';

const activeRouteSettlementLocks = new Map<number, Promise<any>>();

async function withRouteSettlementLock<T>(
  routeId: number,
  task: () => Promise<T>,
): Promise<T> {
  const prev = activeRouteSettlementLocks.get(routeId) ?? Promise.resolve();
  const current = prev.catch(() => undefined).then(() => task());
  activeRouteSettlementLocks.set(routeId, current);
  try {
    return await current;
  } finally {
    if (activeRouteSettlementLocks.get(routeId) === current) {
      activeRouteSettlementLocks.delete(routeId);
    }
  }
}

export interface RouteOrderSettlementItem {
  orderId: number;
  paymentMethod?: string | null;
  bankAccountId?: number | null;
  checkNumber?: string | null;
  checkIssuer?: string | null;
  isEcheq?: boolean | null;
}

export interface SettleDeliveryRouteInput {
  routeId: number;
  userId: number;
  settlements: RouteOrderSettlementItem[];
  cashDeclared?: number | null;
  checksDeclared?: number | null;
  transfersDeclared?: number | null;
}

interface AfipInvoiceResult {
  invoiceType: InvoiceType;
  invoiceNumber: string;
  cae: string | null;
  caeDueDate: Date | null;
  shouldEnqueueDeferredCae: boolean;
  net: number;
  tax: number;
  percepIIBB: number;
  percepIVA: number;
  finalTotal: number;
  isFacturaAOfficial: boolean;
}

async function resolveRoutePaymentDestination(
  tx: any,
  paymentMethod: string,
  driverName: string,
  userId: number,
  personaName: string,
  routeId: number,
  settlement: RouteOrderSettlementItem,
) {
  let cashDrawerId: number | null = null;
  let bankAccountId: number | null = null;
  let txDescription = `Rendición Reparto - Chofer: ${driverName} - Ruta #${routeId} - Pago de ${personaName}`;

  if (paymentMethod === 'CASH') {
    const driverUser = await tx.user.findFirst({
      where: { username: { equals: driverName.trim(), mode: 'insensitive' } },
      select: { id: true, username: true },
    });
    const driverDrawer = driverUser
      ? await tx.cashDrawer.findFirst({
          where: { userId: driverUser.id, status: 'OPEN' },
          select: { id: true },
        })
      : null;

    if (driverDrawer) {
      cashDrawerId = driverDrawer.id;
    } else {
      const activeDrawer = await tx.cashDrawer.findFirst({
        where: { userId, status: 'OPEN' },
        select: { id: true },
      });
      cashDrawerId = activeDrawer?.id ?? null;
    }
  } else if (paymentMethod === 'BANK_TRANSFER') {
    bankAccountId =
      settlement.bankAccountId ||
      (await tx.bankAccount.findFirst({ select: { id: true } }))?.id ||
      null;
  } else if (paymentMethod === 'CHECK') {
    const defaultBank = await tx.bankAccount.findFirst({ select: { id: true } });
    bankAccountId = settlement.bankAccountId || defaultBank?.id || null;
    const rawIssuer = (settlement.checkIssuer || 'Desconocido').trim() || 'Desconocido';
    const isEcheq = Boolean(settlement.isEcheq) || /\(echeq\)|e-?cheq/i.test(rawIssuer);
    const issuerLabel =
      isEcheq && !/\(echeq\)|e-?cheq/i.test(rawIssuer) ? `${rawIssuer} (Echeq)` : rawIssuer;
    txDescription = `Rendición Reparto - Cheque N° ${settlement.checkNumber || 'S/N'} (Emisor: ${issuerLabel}) - Chofer: ${driverName} - Ruta #${routeId}`;
  }

  return { cashDrawerId, bankAccountId, txDescription };
}

function normalizeOptionalPeso(val?: number | null): number | null | undefined {
  if (val === undefined || val === null) return val;
  return roundToIntegerPeso(val).toNumber();
}

export const routeSettlementService = {
  async settleDeliveryRoute(input: SettleDeliveryRouteInput): Promise<void> {
    return withRouteSettlementLock(input.routeId, async () => {
    const route = await prisma.deliveryRoute.findUnique({
      where: { id: input.routeId },
      include: {
        orders: {
          include: {
            persona: {
              select: { id: true, name: true, cuit: true, iibbAliquot: true, province: true, address: true },
            },
            transactions: {
              where: { type: TransactionType.INCOME },
              select: { amount: true },
            },
          },
        },
        fieldReceipts: {
          where: { status: { not: 'VOIDED' } },
          select: {
            id: true,
            receiptNumber: true,
            provisionalCode: true,
            personaId: true,
            status: true,
            totalAmount: true,
            payments: {
              select: {
                paymentMethod: true,
                amount: true,
                status: true,
              },
            },
          },
        },
      },
    });

    if (!route) throw new AppError('Hoja de ruta no encontrada.', 404);
    if (route.status === 'COMPLETED') {
      throw new AppError('La hoja de ruta ya fue completada y liquidada.', 400);
    }

    const activeFieldReceipts: RouteFieldReceiptInput[] = (route.fieldReceipts || []).map((r) => ({
      id: r.id,
      receiptNumber: r.receiptNumber,
      provisionalCode: r.provisionalCode,
      personaId: r.personaId,
      status: r.status,
      totalAmount: r.totalAmount.toString(),
      payments: (r.payments || []).map((p) => ({
        paymentMethod: p.paymentMethod as 'CASH' | 'BANK_TRANSFER' | 'CHECK',
        amount: p.amount.toString(),
        status: p.status,
      })),
    }));

    const evaluation = evaluateRouteSettlementActions(
      route.orders.map((o) => {
        const alreadyPaid = (o.transactions || []).reduce(
          (sum, t) => sum + roundToIntegerPeso(t.amount.toString()).toNumber(),
          0,
        );
        return {
          id: o.id,
          personaId: o.personaId,
          clientName: o.persona?.name || `Cliente #${o.personaId}`,
          invoiceLabel: o.invoiceNumber || `INT-${o.id.toString().padStart(5, '0')}`,
          totalAmount: o.totalAmount.toString(),
          alreadyPaidAmount: alreadyPaid,
        };
      }),
      activeFieldReceipts,
      input.settlements,
    );

    if (evaluation.conflicts.length > 0) {
      throw new AppError(
        evaluation.conflicts.map((c) => c.message).join(' | '),
        409,
      );
    }

    const afipResults: Record<number, AfipInvoiceResult> = {};
    for (const order of route.orders) {
      const set = input.settlements.find((s) => Number(s.orderId) === order.id);
      if (!set) continue;
      if (evaluation.actionsByOrderId[order.id]?.action === 'RETURN_TO_DEPOT') continue;

      if (order.status === OrderStatus.PREPARED && order.billingType === BillingType.OFFICIAL) {
        try {
          const baseTotal = roundToIntegerPeso(order.totalAmount.toString()).toNumber();
          const taxBreakdown = await computeInvoiceTaxBreakdown(
            baseTotal,
            BillingType.OFFICIAL,
            order.persona || {},
          );
          const caeRes = await resolveAfipCaeOrContingency({
            orderId: order.id,
            billingType: BillingType.OFFICIAL,
            finalInvoiceType: taxBreakdown.finalInvoiceType,
            cuitLimpio: taxBreakdown.cuitLimpio,
            docType: taxBreakdown.docType,
            officialOrderTotal: taxBreakdown.finalTotal,
            isFacturaAOfficial: taxBreakdown.isFacturaAOfficial,
            net: taxBreakdown.net,
            tax: taxBreakdown.tax,
            percepIIBB: taxBreakdown.percepIIBB,
            percepIVA: taxBreakdown.percepIVA,
          });
          afipResults[order.id] = {
            invoiceType: taxBreakdown.finalInvoiceType,
            invoiceNumber: caeRes.finalInvoiceNumber,
            cae: caeRes.finalCae,
            caeDueDate: caeRes.finalCaeDueDate ? new Date(caeRes.finalCaeDueDate) : null,
            shouldEnqueueDeferredCae: caeRes.shouldEnqueueDeferredCae,
            net: taxBreakdown.net,
            tax: taxBreakdown.tax,
            percepIIBB: taxBreakdown.percepIIBB,
            percepIVA: taxBreakdown.percepIVA,
            finalTotal: taxBreakdown.finalTotal,
            isFacturaAOfficial: taxBreakdown.isFacturaAOfficial,
          };
        } catch (err: any) {
          throw new AppError(
            `Error emitiendo factura AFIP para pedido #${order.id}: ${err.message}`,
            400,
          );
        }
      }
    }

    const returnedToDepotOrderIds: number[] = [];

    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "DeliveryRoute" WHERE id = ${input.routeId} FOR UPDATE`;
      const freshRoute = await tx.deliveryRoute.findUnique({
        where: { id: input.routeId },
        select: { status: true },
      });
      if (!freshRoute || freshRoute.status === 'COMPLETED') {
        throw new AppError('La hoja de ruta ya fue completada y liquidada.', 409);
      }

      for (const order of route.orders) {
        const set = input.settlements.find((s) => Number(s.orderId) === order.id);
        if (!set) continue;

        const evaluatedAction = evaluation.actionsByOrderId[order.id];
        if (evaluatedAction?.action === 'RETURN_TO_DEPOT') {
          await tx.order.update({
            where: { id: order.id },
            data: {
              deliveryRouteId: null,
              deliverySequence: null,
            },
          });
          returnedToDepotOrderIds.push(order.id);
          continue;
        }

        await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${order.id} FOR UPDATE`;
        const freshOrder = await tx.order.findUnique({
          where: { id: order.id },
          select: { status: true, deliveredAt: true, invoiceNumber: true },
        });
        if (!freshOrder) continue;

        const afipInfo = afipResults[order.id];
        const totalAmount =
          order.billingType === BillingType.OFFICIAL && afipInfo
            ? afipInfo.finalTotal
            : roundToIntegerPeso(order.totalAmount.toString()).toNumber();

        if (freshOrder.status === OrderStatus.PREPARED) {
          const now = new Date();
          let finalInvoiceType: InvoiceType = InvoiceType.PRESUPUESTO;
          let finalInvoiceNumber = `INT-${order.id.toString().padStart(5, '0')}`;
          let finalCae: string | null = null;
          let finalCaeDueDate: Date | null = null;

          const fiscalUpdateData: Record<string, any> = {
            invoicedAt: now,
          };

          if (order.billingType === BillingType.OFFICIAL) {
            if (!afipInfo) throw new Error(`Falta información de AFIP para pedido #${order.id}`);
            finalInvoiceType = afipInfo.invoiceType;
            finalInvoiceNumber = afipInfo.invoiceNumber;
            finalCae = afipInfo.cae;
            finalCaeDueDate = afipInfo.caeDueDate;
            fiscalUpdateData.netAmount = afipInfo.net;
            fiscalUpdateData.taxAmount = afipInfo.tax;
            fiscalUpdateData.percepcionAmount = afipInfo.percepIIBB;
            fiscalUpdateData.percepcionIvaAmount = afipInfo.percepIVA;
            fiscalUpdateData.totalAmount = afipInfo.finalTotal;
          }

          await tx.order.update({
            where: { id: order.id },
            data: {
              status: OrderStatus.DELIVERED,
              deliveredAt: now,
              invoiceType: finalInvoiceType,
              invoiceNumber: finalInvoiceNumber,
              cae: finalCae,
              caeDueDate: finalCaeDueDate ? new Date(finalCaeDueDate) : null,
              ...fiscalUpdateData,
            },
          });

          if (
            order.billingType === BillingType.OFFICIAL &&
            afipInfo &&
            (afipInfo.percepIIBB > 0 || afipInfo.percepIVA > 0)
          ) {
            await recordInvoicePerceptions(tx, {
              personaId: order.personaId,
              invoiceNumber: finalInvoiceNumber,
              percepIIBB: afipInfo.percepIIBB,
              percepIVA: afipInfo.percepIVA,
              isFacturaAOfficial: afipInfo.isFacturaAOfficial,
              provinceOrAddress: order.persona?.province || order.persona?.address || null,
            });
          }

          await recordLedgerMovement(tx, {
            personaId: order.personaId,
            entryType: LedgerEntryType.DEBIT,
            sourceType: LedgerSourceType.ORDER_INVOICE,
            billingType: order.billingType,
            amount: totalAmount,
            orderId: order.id,
            userId: input.userId,
            reference: `Pedido #${order.id}`,
            description: `Factura ${order.invoiceNumber || finalInvoiceNumber} (Reparto Ruta #${route.id})`,
          });

          if (
            evaluatedAction?.action !== 'CREATE_OFFICE_TRANSACTION' &&
            typeof tx.paymentAllocation?.createMany === 'function' &&
            totalAmount > 0
          ) {
            await paymentAllocationService.applyAvailableCreditToOrder(tx, {
              orderId: order.id,
              personaId: order.personaId,
              orderTotal: totalAmount,
            });
          }
        } else if (freshOrder.status === OrderStatus.DELIVERED && !freshOrder.deliveredAt) {
          await tx.order.update({
            where: { id: order.id },
            data: { deliveredAt: new Date() },
          });
        }

        if (evaluatedAction?.action === 'CREATE_OFFICE_TRANSACTION') {
          let chargeAmount = totalAmount;
          if (typeof tx.paymentAllocation?.createMany === 'function') {
            const pendingOnOrder = await paymentAllocationService.getOrderPendingAmount(order.id, tx);
            if (pendingOnOrder <= 0) {
              continue; // Candado anti doble cobro: factura ya cancelada previamente
            }
            chargeAmount = Math.min(totalAmount, pendingOnOrder);
          }

          const { cashDrawerId, bankAccountId, txDescription } =
            await resolveRoutePaymentDestination(
              tx, evaluatedAction.paymentMethod, route.driverName, input.userId, order.persona.name, route.id, set,
            );

          const createdRouteTx = await tx.transaction.create({
            data: {
              orderId: order.id,
              personaId: order.personaId,
              userId: input.userId,
              billingType: order.billingType,
              type: TransactionType.INCOME,
              paymentMethod: evaluatedAction.paymentMethod as PaymentMethod,
              amount: chargeAmount,
              description: txDescription,
              cashDrawerId,
              bankAccountId,
              verificationCode: generateUniqueVerificationCode(),
            },
          });

          const routeReceiptNumber = `REC-${createdRouteTx.movementId.toString().padStart(5, '0')}`;
          await tx.transaction.update({
            where: { id: createdRouteTx.id },
            data: { receiptNumber: routeReceiptNumber },
          });

          if (typeof tx.paymentAllocation?.createMany === 'function') {
            await paymentAllocationService.allocateTransactionToOrders(tx, {
              transactionId: createdRouteTx.id,
              personaId: order.personaId,
              amount: chargeAmount,
              preferredOrderId: order.id,
            });
          }

          await recordLedgerMovement(tx, {
            personaId: order.personaId,
            entryType: LedgerEntryType.CREDIT,
            sourceType: LedgerSourceType.COLLECTION_RECEIPT,
            billingType: order.billingType,
            amount: chargeAmount,
            orderId: order.id,
            transactionId: createdRouteTx.id,
            userId: input.userId,
            reference: `Recibo #${createdRouteTx.id}`,
            description: `Recibo N° ${routeReceiptNumber} - ${txDescription}`,
          });
        }
      }

      await tx.deliveryRoute.update({
        where: { id: input.routeId },
        data: { status: 'COMPLETED' },
      });
    });

    for (const order of route.orders) {
      const set = input.settlements.find((s) => Number(s.orderId) === order.id);
      if (
        set &&
        evaluation.actionsByOrderId[order.id]?.action !== 'RETURN_TO_DEPOT' &&
        order.status === OrderStatus.PREPARED
      ) {
        notifyWebOrderStatusForErpOrder(
          order,
          OrderStatus.DELIVERED,
          `Entregado en Reparto Ruta #${route.id}`,
        );
      }
    }

    for (const [orderIdStr, info] of Object.entries(afipResults)) {
      if (info.shouldEnqueueDeferredCae) {
        const deferredOrderId = Number(orderIdStr);
        enqueueDeferredAfipCaeRetry(deferredOrderId, () =>
          executeDeferredCaeRequest(deferredOrderId),
        );
      }
    }

    await logAudit({
      userId: input.userId,
      action: 'SETTLE_DELIVERY_ROUTE',
      entityType: 'DeliveryRoute',
      entityId: input.routeId,
      newValues: {
        status: 'COMPLETED',
        fieldReceiptsCount: activeFieldReceipts.length,
        fieldReceiptsTotal: evaluation.totals.fieldTotal.toNumber(),
        returnedToDepotOrderIds,
        cashDeclared: normalizeOptionalPeso(input.cashDeclared),
        checksDeclared: normalizeOptionalPeso(input.checksDeclared),
        transfersDeclared: normalizeOptionalPeso(input.transfersDeclared),
      },
    });
    });
  },
};
