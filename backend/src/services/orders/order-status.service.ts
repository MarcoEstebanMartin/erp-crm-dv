import prisma from '../../utils/prisma';
import {
  Role,
  BillingType,
  OrderStatus,
  MovementType,
  TransactionType,
  LedgerEntryType,
  LedgerSourceType,
} from '@prisma/client';
import { logAudit } from '../../utils/audit';
import { roundToIntegerPeso } from '../../core/money';
import { recordLedgerMovement } from '../ledger/account-ledger.service';
import { mergeOrderBultosPreservingWebMetadata } from '../../engines/web-order-lifecycle.engine';
import { processOrderPreparedLotAssignments } from './order-lot-picking.helper';
import { notifyWebOrderStatusForErpOrder } from './web-order-status-bridge.service';

export interface UpdateOrderStatusDto {
  orderId: number;
  userId: number;
  userRole: string;
  status: OrderStatus;
  lotAssignments?: Record<number, { lotId: number; quantity: number }[]>;
  bultosCount?: number;
  bultosDetails?: any;
}

export class OrderStatusService {
  /**
   * Cambia el estado de un pedido en logística (Depósito / Admin).
   * - PREPARED: Asigna lotes FIFO o manuales, ajusta faltantes y recalcula total en pesos enteros.
   * - CANCELLED: Reversa atómicamente stock general, stock de lotes y saldo de cuenta corriente.
   * - Refleja automáticamente el estado hacia chatbot-dv si el pedido ingresó por Web/WhatsApp.
   */
  static async updateOrderStatus(data: UpdateOrderStatusDto) {
    const { orderId, userId, userRole, status, lotAssignments, bultosCount, bultosDetails } = data;

    if (!status || !Object.values(OrderStatus).includes(status)) {
      throw new Error('Estado inválido.');
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      const err: any = new Error('Pedido no encontrado.');
      err.statusCode = 404;
      throw err;
    }

    if (status === OrderStatus.DELIVERED) {
      throw new Error(
        'El estado ENTREGADO (DELIVERED) no se puede asignar manualmente. Debe procesarse a través del módulo de Facturación o de la Liquidación de Reparto en Logística para garantizar la consistencia contable y de stock.',
      );
    }

    if (status === OrderStatus.CANCELLED && order.status === OrderStatus.DELIVERED) {
      if (order.billingType === BillingType.OFFICIAL) {
        throw new Error(
          'No se puede cancelar una factura oficial entregada directamente. Se debe emitir una Nota de Crédito para anularla.',
        );
      }

      const existingPayment = await prisma.transaction.findFirst({
        where: {
          orderId: order.id,
          type: TransactionType.INCOME,
        },
      });

      if (existingPayment) {
        throw new Error(
          `No se puede cancelar el pedido #${order.id} porque posee cobros registrados en caja o cuenta bancaria. Debe anular o revertir el cobro en Finanzas/Cajas antes de cancelar el pedido.`,
        );
      }
    }

    if (userRole === Role.DEPOSITO) {
      if (status !== OrderStatus.PREPARING && status !== OrderStatus.PREPARED) {
        const err: any = new Error(
          'Depósito solo puede pasar pedidos a "Preparando" o "Armado listo para facturar".',
        );
        err.statusCode = 403;
        throw err;
      }
    }

    const initialTotal = roundToIntegerPeso(order.totalAmount).toNumber();

    const updated = await prisma.$transaction(async (tx) => {
      let finalTotalAmount = initialTotal;

      if (status === OrderStatus.PREPARED) {
        finalTotalAmount = await processOrderPreparedLotAssignments(tx, {
          orderId: order.id,
          sellerId: order.sellerId,
          userId,
          lotAssignments,
        });
      }

      const safeBultosDetails = mergeOrderBultosPreservingWebMetadata(
        order.bultosDetails,
        bultosDetails,
      );

      const uOrder = await tx.order.update({
        where: { id: order.id },
        data: {
          status: status as OrderStatus,
          totalAmount: finalTotalAmount,
          bultosCount: bultosCount !== undefined ? Number(bultosCount) : undefined,
          bultosDetails: safeBultosDetails !== undefined ? (safeBultosDetails as any) : undefined,
        },
      });

      if (status === OrderStatus.CANCELLED && order.status !== OrderStatus.CANCELLED) {
        const items = await tx.orderItem.findMany({
          where: { orderId: order.id },
          include: { orderItemLots: true },
        });

        for (const item of items) {
          await tx.product.update({
            where: { id: item.productId },
            data: { stock: { increment: item.quantity } },
          });

          await tx.stockMovement.create({
            data: {
              productId: item.productId,
              quantity: item.quantity,
              type: MovementType.IN,
              orderId: order.id,
              referenceId: `CANCEL-${order.id}`,
              userId,
              reason: `Devolución por cancelación de pedido #${order.id}`,
            },
          });

          const hasLotsAssigned =
            order.status === OrderStatus.PREPARING ||
            order.status === OrderStatus.PREPARED ||
            order.status === OrderStatus.DELIVERED;
          if (hasLotsAssigned) {
            for (const itemLot of item.orderItemLots) {
              await tx.productLot.update({
                where: { id: itemLot.productLotId },
                data: { stock: { increment: itemLot.quantity } },
              });
            }

            await tx.orderItemLot.deleteMany({
              where: { orderItemId: item.id },
            });
          }
        }

        if (order.status === OrderStatus.DELIVERED) {
          await recordLedgerMovement(tx, {
            personaId: order.personaId,
            entryType: LedgerEntryType.CREDIT,
            sourceType: LedgerSourceType.ORDER_CANCELLATION,
            billingType: order.billingType,
            amount: initialTotal,
            orderId: order.id,
            userId,
            reference: `Anulación Pedido #${order.id}`,
            description: `Reversión por cancelación de Pedido #${order.id} (${order.invoiceNumber || 'INT-' + order.id.toString().padStart(5, '0')})`,
          });
        }
      }

      return uOrder;
    });

    await logAudit({
      userId,
      action: 'UPDATE_ORDER_STATUS',
      entityType: 'Order',
      entityId: order.id,
      oldValues: { status: order.status },
      newValues: { status: updated.status },
    });

    const finalTotalNum = roundToIntegerPeso(updated.totalAmount).toNumber();
    const scaleNote =
      status === OrderStatus.PREPARED && finalTotalNum !== initialTotal
        ? `Total final ajustado por pesaje/armado: $${finalTotalNum.toLocaleString('es-AR')}`
        : undefined;

    notifyWebOrderStatusForErpOrder(updated, updated.status, scaleNote);

    return updated;
  }
}
