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
import { lockProductsForUpdate } from '../../utils/db-locks.util';

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

    const updated = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${order.id} FOR UPDATE`;

      const freshOrder = await tx.order.findUnique({ where: { id: order.id } });
      if (!freshOrder) {
        const err: any = new Error('Pedido no encontrado.');
        err.statusCode = 404;
        throw err;
      }

      if (freshOrder.status === OrderStatus.CANCELLED) {
        const err: any = new Error(
          status === OrderStatus.CANCELLED
            ? `El pedido #${order.id} ya se encuentra cancelado.`
            : `No se puede reactivar el pedido #${order.id} porque ya fue cancelado.`,
        );
        err.statusCode = 409;
        throw err;
      }

      if (status === OrderStatus.CANCELLED && freshOrder.status === OrderStatus.DELIVERED) {
        if (freshOrder.billingType === BillingType.OFFICIAL) {
          throw new Error(
            'No se puede cancelar una factura oficial entregada directamente. Se debe emitir una Nota de Crédito para anularla.',
          );
        }

        if (typeof tx.transaction?.findFirst === 'function') {
          const txPayment = await tx.transaction.findFirst({
            where: { orderId: freshOrder.id, type: TransactionType.INCOME },
          });
          if (txPayment) {
            throw new Error(
              `No se puede cancelar el pedido #${freshOrder.id} porque posee cobros registrados en caja o cuenta bancaria. Debe anular o revertir el cobro en Finanzas/Cajas antes de cancelar el pedido.`,
            );
          }
        }

        if (typeof tx.creditNote?.findFirst === 'function') {
          const existingCreditNote = await tx.creditNote.findFirst({
            where: {
              orderId: freshOrder.id,
              status: { in: ['APPROVED', 'PENDING_APPROVAL'] },
            },
            select: { id: true, creditNoteNumber: true },
          });
          if (existingCreditNote) {
            throw new Error(
              `No se puede cancelar el pedido #${freshOrder.id} porque ya posee una Nota de Crédito asociada (${existingCreditNote.creditNoteNumber || '#' + existingCreditNote.id}). Completá la anulación vía Nota de Crédito.`,
            );
          }
        }
      }

      let finalTotalAmount = roundToIntegerPeso(freshOrder.totalAmount).toNumber();

      // Evita doble descuento de lotes si el pedido ya estaba en PREPARED
      if (status === OrderStatus.PREPARED && freshOrder.status !== OrderStatus.PREPARED) {
        const orderItems = await tx.orderItem.findMany({
          where: { orderId: freshOrder.id },
          select: { productId: true },
        });
        await lockProductsForUpdate(
          tx,
          orderItems.map((i) => i.productId),
        );
        finalTotalAmount = await processOrderPreparedLotAssignments(tx, {
          orderId: freshOrder.id,
          sellerId: freshOrder.sellerId,
          userId,
          lotAssignments,
        });
      }

      const safeBultosDetails = mergeOrderBultosPreservingWebMetadata(
        freshOrder.bultosDetails,
        bultosDetails,
      );

      const uOrder = await tx.order.update({
        where: { id: freshOrder.id },
        data: {
          status: status as OrderStatus,
          totalAmount: finalTotalAmount,
          bultosCount: bultosCount !== undefined ? Number(bultosCount) : undefined,
          bultosDetails: safeBultosDetails !== undefined ? (safeBultosDetails as any) : undefined,
        },
      });

      if (status === OrderStatus.CANCELLED) {
        const items = await tx.orderItem.findMany({
          where: { orderId: order.id },
          include: { orderItemLots: true },
        });

        await lockProductsForUpdate(
          tx,
          items.map((i) => i.productId),
        );

        for (const item of items) {
          const hasLotsAssigned =
            freshOrder.status === OrderStatus.PREPARING ||
            freshOrder.status === OrderStatus.PREPARED ||
            freshOrder.status === OrderStatus.DELIVERED;
          const assignedLots = item.orderItemLots || [];

          if (hasLotsAssigned && assignedLots.length > 0) {
            let restoredByLots = 0;
            for (const itemLot of assignedLots) {
              await tx.productLot.update({
                where: { id: itemLot.productLotId },
                data: { stock: { increment: itemLot.quantity } },
              });
              await tx.stockMovement.create({
                data: {
                  productId: item.productId,
                  quantity: itemLot.quantity,
                  type: MovementType.IN,
                  orderId: order.id,
                  referenceId: `CANCEL-${order.id}`,
                  userId,
                  reason: `Devolución por cancelación de pedido #${order.id}`,
                  productLotId: itemLot.productLotId,
                },
              });
              restoredByLots += itemLot.quantity;
            }

            const remainingUnlinked = item.quantity - restoredByLots;
            if (remainingUnlinked > 0) {
              await tx.stockMovement.create({
                data: {
                  productId: item.productId,
                  quantity: remainingUnlinked,
                  type: MovementType.IN,
                  orderId: order.id,
                  referenceId: `CANCEL-${order.id}`,
                  userId,
                  reason: `Devolución por cancelación de pedido #${order.id}`,
                },
              });
            }

            await tx.orderItemLot.deleteMany({
              where: { orderItemId: item.id },
            });
          } else {
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
          }

          // Recalcular stock comercial contra invariante (Σlotes - reservas activas) para evitar stock fantasma
          if (
            typeof tx.productLot?.aggregate === 'function' &&
            typeof tx.orderItem?.aggregate === 'function'
          ) {
            const [lotAgg, reservedAgg] = await Promise.all([
              tx.productLot.aggregate({
                where: { productId: item.productId },
                _sum: { stock: true },
                _count: { _all: true },
              }),
              tx.orderItem.aggregate({
                where: {
                  productId: item.productId,
                  order: { status: { in: [OrderStatus.PENDING, OrderStatus.PREPARING] } },
                },
                _sum: { quantity: true },
              }),
            ]);

            if ((lotAgg._count?._all ?? 0) > 0) {
              const physicalTotal = Number(lotAgg._sum?.stock ?? 0);
              const activeReserved = Number(reservedAgg._sum?.quantity ?? 0);
              const syncedCommercialStock = Math.max(0, physicalTotal - activeReserved);
              await tx.product.update({
                where: { id: item.productId },
                data: { stock: syncedCommercialStock },
              });
            } else {
              await tx.product.update({
                where: { id: item.productId },
                data: { stock: { increment: item.quantity } },
              });
            }
          } else {
            await tx.product.update({
              where: { id: item.productId },
              data: { stock: { increment: item.quantity } },
            });
          }
        }

        if (freshOrder.status === OrderStatus.DELIVERED) {
          await recordLedgerMovement(tx, {
            personaId: freshOrder.personaId,
            entryType: LedgerEntryType.CREDIT,
            sourceType: LedgerSourceType.ORDER_CANCELLATION,
            billingType: freshOrder.billingType,
            amount: finalTotalAmount,
            orderId: freshOrder.id,
            userId,
            reference: `Anulación Pedido #${freshOrder.id}`,
            description: `Reversión por cancelación de Pedido #${freshOrder.id} (${freshOrder.invoiceNumber || 'INT-' + freshOrder.id.toString().padStart(5, '0')})`,
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

    const initialTotal = roundToIntegerPeso(order.totalAmount).toNumber();
    const finalTotalNum = roundToIntegerPeso(updated.totalAmount).toNumber();
    const scaleNote =
      status === OrderStatus.PREPARED && finalTotalNum !== initialTotal
        ? `Total final ajustado por pesaje/armado: $${finalTotalNum.toLocaleString('es-AR')}`
        : undefined;

    notifyWebOrderStatusForErpOrder(updated, updated.status, scaleNote);

    return updated;
  }
}
