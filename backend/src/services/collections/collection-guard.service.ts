import { OrderStatus, Prisma, TransactionType } from '@prisma/client';
import { Decimal } from 'decimal.js';
import AppError from '../../utils/AppError';
import { roundToIntegerPeso } from '../../core/money';
import {
  DUPLICATE_COLLECTION_WINDOW_MS,
  evaluateCollectionGuard,
  type RecentCollectionMatch,
  type TargetOrderBalanceInput,
} from '../../engines/collection-guard.engine';

export interface AssertCollectionAllowedParams {
  personaId: number;
  amount: number | string | Decimal;
  allowCreditOnAccount?: boolean;
  orderId?: number | null;
  deliveryRouteId?: number | null;
  /** Excluye una transacción específica si corresponde. */
  excludeTransactionId?: number;
}

/**
 * Guardia central en base de datos para todos los caminos de cobranza.
 * Se ejecuta dentro de la transacción (o sobre prisma) antes de acreditar plata.
 * Lanza HTTP 409 ante cualquier intento de recibo duplicado o sobrepago no autorizado.
 */
export async function assertCollectionAllowed(
  db: Prisma.TransactionClient | any,
  params: AssertCollectionAllowedParams,
): Promise<void> {
  const persona = await db.persona.findUnique({
    where: { id: Number(params.personaId) },
    select: { id: true, name: true, outstandingBalance: true },
  });
  if (!persona) {
    throw new AppError('Cliente no encontrado.', 404);
  }

  const normalizedAmount = roundToIntegerPeso(params.amount).toNumber();
  const windowStart = new Date(Date.now() - DUPLICATE_COLLECTION_WINDOW_MS);

  // 1. Buscar cualquier cobro INCOME reciente del mismo cliente por el mismo monto (cross-channel)
  const duplicateTx = await db.transaction.findFirst({
    where: {
      personaId: persona.id,
      type: TransactionType.INCOME,
      amount: normalizedAmount,
      createdAt: { gte: windowStart },
      ...(params.excludeTransactionId ? { id: { not: params.excludeTransactionId } } : {}),
    },
    orderBy: { createdAt: 'desc' },
    select: { id: true, receiptNumber: true, amount: true, createdAt: true },
  });

  const recentDuplicate: RecentCollectionMatch | null = duplicateTx
    ? {
        id: duplicateTx.id,
        receiptNumber: duplicateTx.receiptNumber,
        amount: duplicateTx.amount.toString(),
        createdAt: duplicateTx.createdAt,
      }
    : null;

  // 2. Si viene desde un viaje de reparto, sumar pedidos PREPARED aún no facturados del cliente en ese viaje
  let unbilledRouteOrdersAmount = new Decimal(0);
  if (params.deliveryRouteId) {
    const unbilledOrders = await db.order.findMany({
      where: {
        deliveryRouteId: Number(params.deliveryRouteId),
        personaId: persona.id,
        status: OrderStatus.PREPARED,
      },
      select: { totalAmount: true },
    });
    for (const o of unbilledOrders) {
      unbilledRouteOrdersAmount = unbilledRouteOrdersAmount.plus(
        roundToIntegerPeso(o.totalAmount.toString()),
      );
    }
  }

  // 3. Si el cobro se imputa a un pedido específico, verificar cuánto ya se cobró sobre ese pedido
  let targetOrder: TargetOrderBalanceInput | null = null;
  if (params.orderId) {
    const order = await db.order.findUnique({
      where: { id: Number(params.orderId) },
      select: { id: true, invoiceNumber: true, totalAmount: true, status: true },
    });
    if (order) {
      const paidAgg = await db.transaction.aggregate({
        where: {
          orderId: order.id,
          type: TransactionType.INCOME,
        },
        _sum: { amount: true },
      });
      const alreadyPaid = paidAgg?._sum?.amount
        ? roundToIntegerPeso(paidAgg._sum.amount.toString())
        : new Decimal(0);

      targetOrder = {
        orderId: order.id,
        invoiceLabel: order.invoiceNumber || `INT-${order.id.toString().padStart(5, '0')}`,
        orderTotal: order.totalAmount.toString(),
        alreadyPaidOnOrder: alreadyPaid,
      };
    }
  }

  const evaluation = evaluateCollectionGuard({
    clientName: persona.name,
    paymentAmount: normalizedAmount,
    clientOutstandingBalance: persona.outstandingBalance.toString(),
    unbilledRouteOrdersAmount,
    allowCreditOnAccount: Boolean(params.allowCreditOnAccount),
    recentDuplicate,
    targetOrder,
  });

  if (!evaluation.allowed) {
    throw new AppError(
      evaluation.message || 'Cobro bloqueado por control anti-doble cobro.',
      409,
    );
  }
}
