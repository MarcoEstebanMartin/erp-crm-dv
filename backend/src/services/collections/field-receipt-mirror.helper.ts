import { Prisma } from '@prisma/client';
import { type NumericInput, roundToIntegerPeso } from '../../core/money';
import {
  type FieldPaymentMethod,
  evaluateMirrorTransactionSync,
} from '../../engines/fieldReceipts.engine';
import { classifyCollectorChannel } from '../../engines/pending-rendiciones.engine';

export interface CreateSettlementDrawerParams {
  settlementId: number;
  collectorUserId: number;
  collector?: { id: number; username: string; role: string } | null;
  deliveryRouteId?: number | null;
  deliveryRoute?: { id: number; driverName?: string | null; vehiclePlate?: string | null } | null;
  activeReceipts: Array<{
    id: number;
    capturedAt: Date;
    deliveryRouteId?: number | null;
    transactionId?: number | null;
  }>;
  expectedCash: NumericInput;
  expectedChecksAmount: NumericInput;
  declaredCash: NumericInput;
  cashDifference: NumericInput;
  settlementStatus: string;
  settlementCreatedAt: Date;
  adminUserId: number;
  notes?: string | null;
}

/**
 * Sincroniza la Transaction espejo de un FieldReceipt dentro de la misma transacción DB.
 */
export async function syncMirrorTransactionForFieldReceipt(
  tx: Prisma.TransactionClient,
  fieldReceiptId: number,
  adminUserId: number,
) {
  const receipt = await tx.fieldReceipt.findUnique({
    where: { id: fieldReceiptId },
    include: { payments: true },
  });
  if (!receipt) return;

  const decision = evaluateMirrorTransactionSync({
    receiptStatus: receipt.status,
    payments: receipt.payments.map((p) => ({
      paymentMethod: p.paymentMethod as FieldPaymentMethod,
      amount: p.amount.toString(),
      status: p.status,
      bankAccountId: p.bankAccountId,
    })),
  });

  if (decision.action === 'DELETE') {
    if (receipt.transactionId != null) {
      const mirrorTxId = receipt.transactionId;
      await tx.fieldReceipt.update({
        where: { id: receipt.id },
        data: { transactionId: null },
      });
      await tx.transaction.deleteMany({ where: { id: mirrorTxId } });
    }
    return;
  }

  if (decision.action === 'MARK_VERIFIED') {
    if (receipt.status !== decision.receiptStatus) {
      await tx.fieldReceipt.update({
        where: { id: receipt.id },
        data: { status: decision.receiptStatus },
      });
    }
    if (receipt.transactionId != null) {
      await tx.transaction.update({
        where: { id: receipt.transactionId },
        data: {
          verified: true,
          verifiedById: adminUserId,
          verifiedAt: new Date(),
          amount: decision.amount,
          ...(decision.bankAccountId != null ? { bankAccountId: decision.bankAccountId } : {}),
        },
      });
    }
    return;
  }

  if (receipt.transactionId != null) {
    await tx.transaction.update({
      where: { id: receipt.transactionId },
      data: {
        verified: false,
        amount: decision.amount,
        ...(decision.bankAccountId != null ? { bankAccountId: decision.bankAccountId } : {}),
      },
    });
  }
}

/**
 * Crea el CashDrawer cerrado de la rendición aprobada, vincula las Transaction espejo
 * para consolidar en Caja Grande e historial, y registra el log de auditoría.
 */
export async function createSettlementCashDrawerAndLinkMirrors(
  tx: Prisma.TransactionClient,
  params: CreateSettlementDrawerParams,
) {
  const channel = classifyCollectorChannel({
    deliveryRouteId: params.deliveryRouteId,
    receiptDeliveryRouteIds: params.activeReceipts.map((r) => r.deliveryRouteId),
    collectorRole: params.collector?.role,
  });
  const drawerType = channel === 'DRIVER' ? 'REPARTIDOR' : 'VENDEDOR';

  const branchName =
    channel === 'DRIVER'
      ? `REPARTIDOR: ${(params.deliveryRoute?.driverName || params.collector?.username || `#${params.collectorUserId}`).toUpperCase()}${params.deliveryRouteId ? ` (Ruta #${params.deliveryRouteId})` : ''}`
      : `VENDEDOR: ${(params.collector?.username || `#${params.collectorUserId}`).toUpperCase()}`;

  const expectedChecksDec = roundToIntegerPeso(params.expectedChecksAmount);
  const closingBalance = roundToIntegerPeso(params.expectedCash).plus(expectedChecksDec).toNumber();
  const realBalance = roundToIntegerPeso(params.declaredCash).plus(expectedChecksDec).toNumber();

  const openedAt =
    params.activeReceipts.length > 0
      ? params.activeReceipts.reduce(
          (min, r) => (r.capturedAt < min ? r.capturedAt : min),
          params.activeReceipts[0].capturedAt,
        )
      : params.settlementCreatedAt;

  const createdDrawer = await tx.cashDrawer.create({
    data: {
      userId: params.adminUserId,
      branch: branchName,
      drawerType,
      notes: params.notes || null,
      openingBalance: 0,
      closingBalance,
      realBalance,
      status: 'CLOSED',
      openedAt,
      closedAt: new Date(),
    },
  });

  const mirrorTxIds = params.activeReceipts
    .map((r) => r.transactionId)
    .filter((id): id is number => id != null);

  if (mirrorTxIds.length > 0) {
    await tx.transaction.updateMany({
      where: { id: { in: mirrorTxIds }, cashDrawerId: null },
      data: { cashDrawerId: createdDrawer.id },
    });
  }

  await tx.auditLog.create({
    data: {
      userId: params.adminUserId,
      action: 'APPROVE_FIELD_SETTLEMENT',
      entityType: 'CollectorSettlement',
      entityId: params.settlementId,
      newValues: {
        cashDrawerId: createdDrawer.id,
        branch: branchName,
        expectedCash: roundToIntegerPeso(params.expectedCash).toNumber(),
        expectedChecksAmount: expectedChecksDec.toNumber(),
        declaredCash: roundToIntegerPeso(params.declaredCash).toNumber(),
        cashDifference: roundToIntegerPeso(params.cashDifference).toNumber(),
        status: params.settlementStatus,
      },
    },
  });

  return createdDrawer;
}
