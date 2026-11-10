import prisma from '../../utils/prisma';
import { Role, BillingType, OrderStatus, MovementType, TransactionType } from '@prisma/client';
import { logAudit } from '../../utils/audit';
import {
  roundToIntegerPeso,
  roundToThreeDecimalsWeight,
  sumIntegerAmounts,
  toDecimal,
} from '../../core/money';

export interface UpdateOrderStatusDto {
  orderId: number;
  userId: number;
  userRole: string;
  status: OrderStatus;
  lotAssignments?: Record<number, { lotId: number; quantity: number }[]>;
  bultosCount?: number;
  bultosDetails?: string;
}

export class OrderStatusService {
  /**
   * Cambia el estado de un pedido en logística (Depósito / Admin).
   * - PREPARED: Asigna lotes FIFO o manuales, ajusta faltantes y recalcula total en pesos enteros.
   * - CANCELLED: Reversa atómicamente stock general, stock de lotes y saldo de cuenta corriente.
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
      let finalTotalAmount = roundToIntegerPeso(order.totalAmount).toNumber();

      // 1. Si pasa a PREPARED, validar y procesar lotes
      if (status === OrderStatus.PREPARED) {
        if (!lotAssignments) {
          throw new Error('Las asignaciones de lote son requeridas para marcar el pedido como Armado.');
        }

        const items = await tx.orderItem.findMany({
          where: { orderId: order.id },
          include: { product: true },
        });

        const updatedSubtotals: number[] = [];

        for (const item of items) {
          const userAssignments = lotAssignments[item.id] || [];
          const totalUserAssigned = userAssignments.reduce(
            (sum: number, a: any) => sum + Number(a.quantity),
            0,
          );

          if (totalUserAssigned > item.quantity) {
            throw new Error(
              `Asignación inválida para "${item.product.name}". Cantidad asignada (${totalUserAssigned}) supera la cantidad pedida (${item.quantity}).`,
            );
          }

          const finalAssignments: { lotId: number; quantity: number }[] = [];
          for (const uAs of userAssignments) {
            const q = Number(uAs.quantity);
            if (q > 0) {
              finalAssignments.push({ lotId: Number(uAs.lotId), quantity: q });
            }
          }

          let remainingToAssign = item.quantity - totalUserAssigned;
          if (remainingToAssign > 0) {
            const activeLots = await tx.productLot.findMany({
              where: {
                productId: item.productId,
                stock: { gt: 0 },
                id: { notIn: finalAssignments.map((fa) => fa.lotId) },
              },
              orderBy: { expirationDate: 'asc' },
            });

            for (const lot of activeLots) {
              if (remainingToAssign <= 0) break;
              const allocatedQty = Math.min(lot.stock, remainingToAssign);
              if (allocatedQty > 0) {
                finalAssignments.push({ lotId: lot.id, quantity: allocatedQty });
                remainingToAssign -= allocatedQty;
              }
            }

            if (remainingToAssign > 0 && process.env.IGNORE_STOCK_CHECK === 'true') {
              let slLot = await tx.productLot.findFirst({
                where: { productId: item.productId, lotNumber: 'S/L' },
              });
              if (!slLot) {
                slLot = await tx.productLot.create({
                  data: {
                    productId: item.productId,
                    lotNumber: 'S/L',
                    expirationDate: new Date('2036-12-31T00:00:00Z'),
                    stock: 0,
                    location: 'S/U',
                  },
                });
              }
              finalAssignments.push({ lotId: slLot.id, quantity: remainingToAssign });
              remainingToAssign = 0;
            }
          }

          const totalAssigned = finalAssignments.reduce((sum, a) => sum + a.quantity, 0);
          const diff = item.quantity - totalAssigned;
          if (diff > 0) {
            await tx.product.update({
              where: { id: item.productId },
              data: { stock: { increment: diff } },
            });

            await tx.stockMovement.create({
              data: {
                productId: item.productId,
                quantity: diff,
                type: MovementType.IN,
                orderId: order.id,
                referenceId: `PICK-SHORT-${order.id}`,
                userId,
                reason: `Devolución por faltante en preparación de Pedido #${order.id}`,
              },
            });
          }

          let newSubtotal = roundToIntegerPeso(item.subtotal).toNumber();
          let newWeight = item.weight ? roundToThreeDecimalsWeight(item.weight).toNumber() : null;
          if (totalAssigned === 0) {
            newSubtotal = 0;
            newWeight = 0;
          } else if (item.product.isPesable && newWeight !== null && newWeight > 0) {
            newSubtotal = roundToIntegerPeso(toDecimal(item.unitPrice).times(newWeight)).toNumber();
          } else {
            newSubtotal = roundToIntegerPeso(toDecimal(item.unitPrice).times(totalAssigned)).toNumber();
          }

          await tx.orderItem.update({
            where: { id: item.id },
            data: {
              quantity: totalAssigned,
              subtotal: newSubtotal,
              weight: newWeight,
            },
          });

          updatedSubtotals.push(newSubtotal);

          for (const assignment of finalAssignments) {
            const { lotId, quantity } = assignment;
            const lot = await tx.productLot.findUnique({ where: { id: lotId } });
            if (!lot) continue;

            await tx.productLot.update({
              where: { id: lot.id },
              data: { stock: { decrement: quantity } },
            });

            await tx.orderItemLot.create({
              data: {
                orderItemId: item.id,
                productLotId: lot.id,
                quantity,
              },
            });

            const originalMov = await tx.stockMovement.findFirst({
              where: {
                productId: item.productId,
                referenceId: `ORDER-${order.id}`,
                productLotId: null,
              },
            });

            if (originalMov) {
              await tx.stockMovement.update({
                where: { id: originalMov.id },
                data: { productLotId: lot.id, orderId: order.id },
              });
            } else {
              await tx.stockMovement.create({
                data: {
                  productId: item.productId,
                  quantity: -quantity,
                  type: MovementType.OUT,
                  orderId: order.id,
                  referenceId: `ORDER-${order.id}`,
                  userId: order.sellerId,
                  reason: `Venta - Descuento físico de Lote #${lot.lotNumber} para Pedido #${order.id}`,
                  productLotId: lot.id,
                },
              });
            }
          }
        }

        finalTotalAmount = sumIntegerAmounts(updatedSubtotals).toNumber();
      }

      const uOrder = await tx.order.update({
        where: { id: order.id },
        data: {
          status: status as OrderStatus,
          totalAmount: finalTotalAmount,
          bultosCount: bultosCount !== undefined ? Number(bultosCount) : undefined,
          bultosDetails: bultosDetails !== undefined ? bultosDetails : undefined,
        },
      });

      // 2. Si se cancela, reversar atómicamente stock general, lotes y cuenta corriente
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
          await tx.persona.update({
            where: { id: order.personaId },
            data: {
              outstandingBalance: {
                decrement: roundToIntegerPeso(order.totalAmount).toNumber(),
              },
            },
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

    return updated;
  }
}
