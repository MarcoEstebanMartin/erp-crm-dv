import {
  BillingType, InvoiceType, LedgerEntryType, LedgerSourceType,
  OrderStatus, PaymentMethod, TransactionType,
} from '@prisma/client';
import prisma from '../../utils/prisma';
import AppError from '../../utils/AppError';
import { logAudit } from '../../utils/audit';
import { roundToIntegerPeso } from '../../core/money';
import { emitirFacturaAFIP } from '../afip.service';
import { recordLedgerMovement } from '../ledger/account-ledger.service';
import { notifyWebOrderStatusForErpOrder } from '../orders/web-order-status-bridge.service';

export interface RouteOrderSettlementItem {
  orderId: number;
  paymentMethod?: string | null;
  bankAccountId?: number | null;
  checkNumber?: string | null;
  checkIssuer?: string | null;
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
    bankAccountId = defaultBank?.id ?? null;
    txDescription = `Rendición Reparto - Cheque N° ${settlement.checkNumber || 'S/N'} (Emisor: ${settlement.checkIssuer || 'Desconocido'}) - Chofer: ${driverName} - Ruta #${routeId}`;
  }

  return { cashDrawerId, bankAccountId, txDescription };
}

function normalizeOptionalPeso(val?: number | null): number | null | undefined {
  if (val === undefined || val === null) return val;
  return roundToIntegerPeso(val).toNumber();
}

export const routeSettlementService = {
  async settleDeliveryRoute(input: SettleDeliveryRouteInput): Promise<void> {
    const route = await prisma.deliveryRoute.findUnique({
      where: { id: input.routeId },
      include: {
        orders: {
          include: { persona: { select: { id: true, name: true, cuit: true } } },
        },
      },
    });

    if (!route) throw new AppError('Hoja de ruta no encontrada.', 404);
    if (route.status === 'COMPLETED') {
      throw new AppError('La hoja de ruta ya fue completada y liquidada.', 400);
    }

    const afipResults: Record<number, AfipInvoiceResult> = {};
    for (const order of route.orders) {
      const set = input.settlements.find((s) => Number(s.orderId) === order.id);
      if (!set) continue;

      if (order.status === OrderStatus.PREPARED && order.billingType === BillingType.OFFICIAL) {
        try {
          const cuit = order.persona?.cuit;
          const invoiceType = cuit && cuit.length > 5 ? InvoiceType.FACTURA_A : InvoiceType.FACTURA_B;
          const afipRes = await emitirFacturaAFIP({
            total: roundToIntegerPeso(order.totalAmount.toString()).toNumber(),
            clientDocType: invoiceType === InvoiceType.FACTURA_A ? 80 : 99,
            clientCuit: invoiceType === InvoiceType.FACTURA_A ? cuit?.replace(/\D/g, '') || '0' : '0',
            invoiceType: invoiceType === InvoiceType.FACTURA_A ? 'A' : 'B',
          });
          afipResults[order.id] = {
            invoiceType,
            invoiceNumber: afipRes.invoiceNumber,
            cae: afipRes.cae,
            caeDueDate: afipRes.caeDueDate ? new Date(afipRes.caeDueDate) : null,
          };
        } catch (err: any) {
          throw new AppError(
            `Error emitiendo factura AFIP para pedido #${order.id}: ${err.message}`,
            400,
          );
        }
      }
    }

    await prisma.$transaction(async (tx) => {
      for (const order of route.orders) {
        const set = input.settlements.find((s) => Number(s.orderId) === order.id);
        if (!set) continue;

        const totalAmount = roundToIntegerPeso(order.totalAmount.toString()).toNumber();

        if (order.status === OrderStatus.PREPARED) {
          let finalInvoiceType: InvoiceType = InvoiceType.PRESUPUESTO;
          let finalInvoiceNumber = `INT-${order.id.toString().padStart(5, '0')}`;
          let finalCae: string | null = null;
          let finalCaeDueDate: Date | null = null;

          if (order.billingType === BillingType.OFFICIAL) {
            const afipInfo = afipResults[order.id];
            if (!afipInfo) throw new Error(`Falta información de AFIP para pedido #${order.id}`);
            finalInvoiceType = afipInfo.invoiceType;
            finalInvoiceNumber = afipInfo.invoiceNumber;
            finalCae = afipInfo.cae;
            finalCaeDueDate = afipInfo.caeDueDate;
          }

          await tx.order.update({
            where: { id: order.id },
            data: {
              status: OrderStatus.DELIVERED,
              invoiceType: finalInvoiceType,
              invoiceNumber: finalInvoiceNumber,
              cae: finalCae,
              caeDueDate: finalCaeDueDate ? new Date(finalCaeDueDate) : null,
            },
          });

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
        }

        if (set.paymentMethod && set.paymentMethod !== 'CREDITO') {
          const { cashDrawerId, bankAccountId, txDescription } =
            await resolveRoutePaymentDestination(
              tx, set.paymentMethod, route.driverName, input.userId, order.persona.name, route.id, set,
            );

          const createdRouteTx = await tx.transaction.create({
            data: {
              orderId: order.id,
              personaId: order.personaId,
              userId: input.userId,
              billingType: order.billingType,
              type: TransactionType.INCOME,
              paymentMethod: set.paymentMethod as PaymentMethod,
              amount: totalAmount,
              description: txDescription,
              cashDrawerId,
              bankAccountId,
            },
          });

          const routeReceiptNumber = `REC-${createdRouteTx.movementId.toString().padStart(5, '0')}`;
          await tx.transaction.update({
            where: { id: createdRouteTx.id },
            data: { receiptNumber: routeReceiptNumber },
          });

          await recordLedgerMovement(tx, {
            personaId: order.personaId,
            entryType: LedgerEntryType.CREDIT,
            sourceType: LedgerSourceType.COLLECTION_RECEIPT,
            billingType: order.billingType,
            amount: totalAmount,
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
      if (set && order.status === OrderStatus.PREPARED) {
        notifyWebOrderStatusForErpOrder(
          order,
          OrderStatus.DELIVERED,
          `Entregado en Reparto Ruta #${route.id}`,
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
        cashDeclared: normalizeOptionalPeso(input.cashDeclared),
        checksDeclared: normalizeOptionalPeso(input.checksDeclared),
        transfersDeclared: normalizeOptionalPeso(input.transfersDeclared),
      },
    });
  },
};
