import { Prisma } from '@prisma/client';
import { Decimal } from 'decimal.js';
import prisma from '../../utils/prisma';
import AppError from '../../utils/AppError';
import {
  roundToIntegerPeso,
  roundToTwoDecimals,
  toDecimal,
  type NumericInput,
} from '../../core/money';
import { paymentAllocationService } from '../finance/payment-allocation.service';

export interface FieldReceiptAllocationPreference {
  orderId?: number;
  orderIds?: number[];
  applyToUnbilledBalance?: boolean;
}

export function normalizeAllocationPreference(input: {
  orderId?: number | null;
  orderIds?: number[] | null;
  applyToUnbilledBalance?: boolean | null;
}): FieldReceiptAllocationPreference | null {
  const uniqueIds = Array.isArray(input.orderIds)
    ? Array.from(
        new Set(
          input.orderIds
            .map((v) => Number(v))
            .filter((n) => Number.isInteger(n) && n > 0),
        ),
      )
    : [];
  const rawOrderId = input.orderId ? Number(input.orderId) : null;
  const orderId =
    rawOrderId && Number.isInteger(rawOrderId) && rawOrderId > 0 ? rawOrderId : undefined;
  const applyToUnbilledBalance = Boolean(input.applyToUnbilledBalance);

  if (!orderId && uniqueIds.length === 0 && !applyToUnbilledBalance) {
    return null;
  }

  return {
    ...(orderId ? { orderId } : {}),
    ...(uniqueIds.length > 0 ? { orderIds: uniqueIds } : {}),
    ...(applyToUnbilledBalance ? { applyToUnbilledBalance: true } : {}),
  };
}

export function parseAllocationPreference(
  raw: unknown,
): FieldReceiptAllocationPreference | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  return normalizeAllocationPreference({
    orderId: typeof obj.orderId === 'number' ? obj.orderId : Number(obj.orderId) || null,
    orderIds: Array.isArray(obj.orderIds)
      ? obj.orderIds.map((v) => Number(v)).filter((n) => Number.isInteger(n) && n > 0)
      : undefined,
    applyToUnbilledBalance: Boolean(obj.applyToUnbilledBalance),
  });
}

export async function getCollectorClientPendingInvoices(personaId: number) {
  const persona = await prisma.persona.findUnique({
    where: { id: personaId },
    select: { id: true, isClient: true, outstandingBalance: true },
  });
  if (!persona || !persona.isClient) {
    throw new AppError('Cliente no encontrado', 404);
  }

  const summary = await paymentAllocationService.getClientPendingInvoicesWithAllocations(persona.id);
  const outstandingBalance = roundToIntegerPeso(persona.outstandingBalance.toString()).toNumber();
  const pendingOnInvoices = roundToIntegerPeso(summary.totalPendingOnInvoices || 0).toNumber();
  const unbilledBalance = Math.max(0, outstandingBalance - pendingOnInvoices);
  const totalAvailableCredit = Math.max(0, pendingOnInvoices - outstandingBalance);

  return {
    ...summary,
    outstandingBalance,
    unbilledBalance,
    totalAvailableCredit,
  };
}

export async function allocateFieldReceiptTransaction(
  tx: Prisma.TransactionClient | any,
  params: {
    transactionId: number;
    personaId: number;
    personaOutstandingBalance?: NumericInput | null;
    amount: NumericInput;
    preference?: FieldReceiptAllocationPreference | null;
  },
) {
  if (typeof tx?.paymentAllocation?.createMany !== 'function') {
    return;
  }

  let amountForOrders = roundToTwoDecimals(params.amount);
  if (amountForOrders.lte(0)) return;

  const pref = params.preference ?? null;

  if (pref?.applyToUnbilledBalance) {
    let rawOutstanding = params.personaOutstandingBalance;
    if (rawOutstanding === undefined || rawOutstanding === null) {
      if (typeof tx?.persona?.findUnique === 'function') {
        const p = await tx.persona.findUnique({
          where: { id: params.personaId },
          select: { outstandingBalance: true },
        });
        rawOutstanding = p?.outstandingBalance?.toString() ?? '0';
      } else {
        rawOutstanding = 0;
      }
    }

    const currentSummary = await paymentAllocationService.getClientPendingInvoicesWithAllocations(
      params.personaId,
      tx,
    );
    const currentOutstanding = roundToTwoDecimals(toDecimal(rawOutstanding ?? 0));
    const currentPendingOnOrders = roundToTwoDecimals(currentSummary.totalPendingOnInvoices || 0);
    const unbilledToCover = Decimal.max(
      0,
      roundToTwoDecimals(currentOutstanding.minus(currentPendingOnOrders)),
    );

    if (unbilledToCover.gt(0)) {
      const absorbedByUnbilled = Decimal.min(amountForOrders, unbilledToCover);
      amountForOrders = roundToTwoDecimals(amountForOrders.minus(absorbedByUnbilled));
    }
  }

  if (amountForOrders.lte(0)) return;

  const preferredOrderIds =
    pref?.orderIds && pref.orderIds.length > 0
      ? pref.orderIds
      : pref?.orderId
        ? [pref.orderId]
        : undefined;

  await paymentAllocationService.allocateTransactionToOrders(tx, {
    transactionId: params.transactionId,
    personaId: params.personaId,
    amount: amountForOrders.toNumber(),
    preferredOrderId: pref?.orderId ?? null,
    preferredOrderIds,
  });
}
