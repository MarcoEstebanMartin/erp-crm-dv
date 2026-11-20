import {
  BillingType,
  FieldReceiptStatus,
  LedgerEntryType,
  LedgerSourceType,
  PaymentMethod,
  PaymentVerificationStatus,
  Prisma,
  TransactionType,
} from '@prisma/client';
import { type NumericInput, roundToIntegerPeso } from '../../core/money';
import { generateUniqueVerificationCode } from '../../core/receiptToken';
import {
  type FieldPaymentMethod,
  type MirrorTransactionSyncAction,
  computeCollectorSettlementSummary,
  computeCreditedReceiptAmount,
  computeReversalAmount,
  evaluateMirrorTransactionSync,
} from '../../engines/fieldReceipts.engine';
import { classifyCollectorChannel } from '../../engines/pending-rendiciones.engine';
import { recordLedgerMovement } from '../ledger/account-ledger.service';

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

export interface ApplyTransferClearParams {
  payment: {
    id: number;
    fieldReceiptId: number;
  };
  receipt: {
    id: number;
    receiptNumber: string | null;
    transactionId: number | null;
    personaId: number;
    collectorUserId: number;
    billingType: BillingType;
    status: FieldReceiptStatus;
    payments: Array<{
      id: number;
      paymentMethod: PaymentMethod;
      amount: Prisma.Decimal | string | number;
      status: PaymentVerificationStatus;
    }>;
  };
  targetBankId: number;
  amountNum: number;
  adminUserId: number;
  now: Date;
}

/**
 * Recalcula los totales pendientes de una rendición abierta a partir de sus recibos.
 */
export async function recomputeOpenSettlement(tx: Prisma.TransactionClient, settlementId: number) {
  const receipts = await tx.fieldReceipt.findMany({
    where: { settlementId },
    include: { payments: true },
  });

  const summary = computeCollectorSettlementSummary(
    receipts.map((r) => ({
      status: r.status,
      payments: r.payments.map((p) => ({
        paymentMethod: p.paymentMethod as FieldPaymentMethod,
        amount: p.amount.toString(),
        status: p.status,
      })),
    })),
  );

  return tx.collectorSettlement.update({
    where: { id: settlementId },
    data: {
      expectedCash: summary.expectedCash.toNumber(),
      expectedChecksCount: summary.expectedChecksCount,
      expectedChecksAmount: summary.expectedChecksAmount.toNumber(),
      pendingTransfersAmount: summary.pendingTransfersAmount.toNumber(),
    },
  });
}

/**
 * Acredita una transferencia en banco, impacta en AccountLedger y emite el recibo
 * definitivo (o transacción de acreditación en recibos mixtos) dentro de la misma tx.
 */
export async function applyTransferClearAndIssueReceipt(
  tx: Prisma.TransactionClient,
  params: ApplyTransferClearParams,
) {
  await tx.fieldReceiptPayment.update({
    where: { id: params.payment.id },
    data: { status: 'CLEARED', bankAccountId: params.targetBankId, verifiedAt: params.now },
  });

  await tx.bankAccount.update({
    where: { id: params.targetBankId },
    data: { balance: { increment: params.amountNum } },
  });

  const hasPaymentInReceipt = params.receipt.payments.some((p) => p.id === params.payment.id);
  const rawPayments = hasPaymentInReceipt
    ? params.receipt.payments
    : [
        ...params.receipt.payments,
        {
          id: params.payment.id,
          paymentMethod: PaymentMethod.BANK_TRANSFER,
          amount: params.amountNum,
          status: PaymentVerificationStatus.CLEARED,
        },
      ];

  const updatedPayments = rawPayments.map((p) => ({
    paymentMethod: p.paymentMethod as FieldPaymentMethod,
    amount: p.amount.toString(),
    status: p.id === params.payment.id ? ('CLEARED' as const) : p.status,
  }));

  const hasRemainingPending = updatedPayments.some(
    (p) => p.status === 'IN_TRANSIT' || p.status === 'PENDING_BANK',
  );
  const creditedSum = computeCreditedReceiptAmount(updatedPayments).toNumber();

  const isInitialOfficialIssue = !params.receipt.receiptNumber && !params.receipt.transactionId;
  const officialReceiptNumber =
    params.receipt.receiptNumber || `REC-C-${String(params.receipt.id).padStart(7, '0')}`;
  const txReceiptNumber = isInitialOfficialIssue
    ? officialReceiptNumber
    : `${officialReceiptNumber}-T${params.payment.id}`;

  const createdTx = await tx.transaction.create({
    data: {
      personaId: params.receipt.personaId,
      userId: params.receipt.collectorUserId,
      billingType: params.receipt.billingType,
      type: TransactionType.INCOME,
      paymentMethod: PaymentMethod.BANK_TRANSFER,
      amount: params.amountNum,
      receiptNumber: txReceiptNumber,
      verificationCode: generateUniqueVerificationCode(),
      description: isInitialOfficialIssue
        ? `Cobro digital en calle (${officialReceiptNumber})`
        : `Acreditación transferencia en calle (${officialReceiptNumber})`,
      bankAccountId: params.targetBankId,
      verified: true,
      verifiedById: params.adminUserId,
      verifiedAt: params.now,
    },
  });

  await recordLedgerMovement(tx, {
    personaId: params.receipt.personaId,
    entryType: LedgerEntryType.CREDIT,
    sourceType: LedgerSourceType.COLLECTION_RECEIPT,
    billingType: params.receipt.billingType,
    amount: params.amountNum,
    reference: officialReceiptNumber,
    description: isInitialOfficialIssue
      ? `Recibo digital en calle ${officialReceiptNumber}`
      : `Acreditación transferencia recibo ${officialReceiptNumber}`,
    transactionId: createdTx.id,
    userId: params.adminUserId,
    occurredAt: params.now,
  });

  const nextStatus = hasRemainingPending
    ? isInitialOfficialIssue
      ? 'PENDING_VERIFICATION'
      : undefined
    : params.receipt.status !== 'VOIDED'
      ? 'VERIFIED'
      : undefined;

  await tx.fieldReceipt.update({
    where: { id: params.receipt.id },
    data: {
      totalAmount: creditedSum,
      ...(isInitialOfficialIssue
        ? { receiptNumber: officialReceiptNumber, transactionId: createdTx.id }
        : {}),
      ...(nextStatus ? { status: nextStatus } : {}),
    },
  });
}

async function applyPrimaryMirrorDecision(
  tx: Prisma.TransactionClient,
  receiptId: number,
  transactionId: number | null,
  decision: MirrorTransactionSyncAction,
  adminUserId: number,
  includeBankAccount: boolean,
) {
  if (decision.action === 'DELETE') {
    if (transactionId != null) {
      await tx.fieldReceipt.update({ where: { id: receiptId }, data: { transactionId: null } });
      await tx.transaction.deleteMany({ where: { id: transactionId } });
    }
    return;
  }

  if (transactionId == null) return;

  const bankPatch =
    includeBankAccount && decision.bankAccountId != null
      ? { bankAccountId: decision.bankAccountId }
      : {};

  await tx.transaction.update({
    where: { id: transactionId },
    data:
      decision.action === 'MARK_VERIFIED'
        ? {
            verified: true,
            verifiedById: adminUserId,
            verifiedAt: new Date(),
            amount: decision.amount,
            ...bankPatch,
          }
        : { verified: false, amount: decision.amount, ...bankPatch },
  });
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

  const mappedPayments = receipt.payments.map((p) => ({
    paymentMethod: p.paymentMethod as FieldPaymentMethod,
    amount: p.amount.toString(),
    status: p.status,
    bankAccountId: p.bankAccountId,
  }));
  const immediatePayments = mappedPayments.filter((p) => p.paymentMethod !== 'BANK_TRANSFER');
  const hasImmediate = immediatePayments.length > 0;

  const decision = evaluateMirrorTransactionSync({
    receiptStatus: receipt.status,
    payments: hasImmediate ? immediatePayments : mappedPayments,
  });

  if (!hasImmediate && decision.action === 'MARK_VERIFIED' && receipt.status !== decision.receiptStatus) {
    await tx.fieldReceipt.update({ where: { id: receipt.id }, data: { status: decision.receiptStatus } });
  }

  await applyPrimaryMirrorDecision(tx, receipt.id, receipt.transactionId, decision, adminUserId, !hasImmediate);

  if (hasImmediate && receipt.status !== 'VOIDED') {
    const hasAnyPending = mappedPayments.some((p) => p.status === 'IN_TRANSIT' || p.status === 'PENDING_BANK');
    const hasAnyCleared = mappedPayments.some((p) => p.status === 'CLEARED');
    const nextData: Prisma.FieldReceiptUpdateInput = {};

    if (!hasAnyPending && hasAnyCleared && receipt.status !== 'VERIFIED') {
      nextData.status = 'VERIFIED';
    }
    if (receipt.receiptNumber != null) {
      const creditedTotal = computeCreditedReceiptAmount(mappedPayments).toNumber();
      if (creditedTotal !== roundToIntegerPeso(receipt.totalAmount?.toString() ?? 0).toNumber()) {
        nextData.totalAmount = creditedTotal;
      }
    }
    if (Object.keys(nextData).length > 0) {
      await tx.fieldReceipt.update({ where: { id: receipt.id }, data: nextData });
    }
  }
}

/**
 * Revierte en AccountLedger, bancos y transacciones espejo al anular un recibo de calle.
 */
export async function voidFieldReceiptAndReverse(
  tx: Prisma.TransactionClient,
  receipt: {
    id: number;
    personaId: number;
    billingType: BillingType;
    receiptNumber: string | null;
    provisionalCode: string;
    transactionId: number | null;
    settlementId: number | null;
    payments: Array<{
      paymentMethod: PaymentMethod;
      amount: Prisma.Decimal | string | number;
      status: PaymentVerificationStatus;
      bankAccountId: number | null;
    }>;
  },
  adminUserId: number,
  voidReason: string,
) {
  const creditedSumDec = computeCreditedReceiptAmount(
    receipt.payments.map((p) => ({
      paymentMethod: p.paymentMethod as FieldPaymentMethod,
      amount: p.amount.toString(),
      status: p.status,
    })),
  );

  if (creditedSumDec.gt(0)) {
    await recordLedgerMovement(tx, {
      personaId: receipt.personaId,
      entryType: LedgerEntryType.DEBIT,
      sourceType: LedgerSourceType.RECEIPT_REVERSAL,
      billingType: receipt.billingType,
      amount: computeReversalAmount(creditedSumDec).toNumber(),
      reference: receipt.receiptNumber ?? receipt.provisionalCode,
      description: `Anulación de recibo ${receipt.receiptNumber ?? receipt.provisionalCode}: ${voidReason}`,
      userId: adminUserId,
    });
  }

  for (const p of receipt.payments) {
    if (p.paymentMethod === PaymentMethod.BANK_TRANSFER && p.status === 'CLEARED' && p.bankAccountId) {
      const clearedAmt = roundToIntegerPeso(p.amount.toString()).toNumber();
      if (clearedAmt > 0) {
        await tx.bankAccount.update({ where: { id: p.bankAccountId }, data: { balance: { decrement: clearedAmt } } });
      }
    }
  }

  const mirrorTxId = receipt.transactionId;
  const voided = await tx.fieldReceipt.update({
    where: { id: receipt.id },
    data: { status: 'VOIDED', voidReason, voidedByUserId: adminUserId, voidedAt: new Date(), transactionId: null },
    include: { payments: true },
  });

  if (mirrorTxId) await tx.transaction.deleteMany({ where: { id: mirrorTxId } });
  if (receipt.receiptNumber) {
    await tx.transaction.deleteMany({ where: { receiptNumber: { startsWith: `${receipt.receiptNumber}-T` } } });
  }
  if (receipt.settlementId) await recomputeOpenSettlement(tx, receipt.settlementId);
  return voided;
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
  const isAdminCollector = channel !== 'DRIVER' && params.collector?.role === 'ADMIN';
  const drawerType =
    channel === 'DRIVER' ? 'REPARTIDOR' : isAdminCollector ? 'ADMINISTRACION' : 'VENDEDOR';

  const branchName =
    channel === 'DRIVER'
      ? `REPARTIDOR: ${(params.deliveryRoute?.driverName || params.collector?.username || `#${params.collectorUserId}`).toUpperCase()}${params.deliveryRouteId ? ` (Ruta #${params.deliveryRouteId})` : ''}`
      : `${drawerType}: ${(params.collector?.username || `#${params.collectorUserId}`).toUpperCase()}`;

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
