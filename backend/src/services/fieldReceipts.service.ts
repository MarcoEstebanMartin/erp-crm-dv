import {
  BillingType,
  LedgerEntryType,
  LedgerSourceType,
  PaymentMethod,
  Prisma,
  TransactionType,
} from '@prisma/client';
import { Decimal } from 'decimal.js';
import prisma from '../utils/prisma';
import AppError from '../utils/AppError';
import { roundToIntegerPeso } from '../core/money';
import {
  computeCollectorSettlementSummary,
  computeReceiptBreakdown,
  computeReversalAmount,
  evaluateSettlementArqueo,
} from '../engines/fieldReceipts.engine';
import { recordLedgerMovement } from './ledger/account-ledger.service';
import { assertCollectionAllowed } from './collections/collection-guard.service';
import { generateUniqueVerificationCode } from '../core/receiptToken';
import {
  ApproveSettlementInput,
  SyncFieldReceiptInput,
  VerifyTransferInput,
} from '../validators/fieldReceipts.schema';

async function recomputeOpenSettlement(tx: Prisma.TransactionClient, settlementId: number) {
  const receipts = await tx.fieldReceipt.findMany({
    where: { settlementId },
    include: { payments: true },
  });

  const summary = computeCollectorSettlementSummary(
    receipts.map((r) => ({
      status: r.status,
      payments: r.payments.map((p) => ({
        paymentMethod: p.paymentMethod as 'CASH' | 'BANK_TRANSFER' | 'CHECK',
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

export const fieldReceiptsService = {
  /**
   * Descarga hoja de ruta, clientes con saldo real y bancos para operar sin señal (PWA).
   */
  async getOfflineBundle(collectorUserId: number) {
    const [clients, bankAccounts, openSettlement] = await Promise.all([
      prisma.persona.findMany({
        where: { isClient: true, isActive: true },
        select: {
          id: true,
          name: true,
          cuit: true,
          city: true,
          address: true,
          phone: true,
          route: true,
          saleRouteId: true,
          routeSequence: true,
          outstandingBalance: true,
          sellerId: true,
        },
        orderBy: [{ routeSequence: 'asc' }, { name: 'asc' }],
      }),
      prisma.bankAccount.findMany({
        select: { id: true, name: true, accountNumber: true },
        orderBy: { name: 'asc' },
      }),
      prisma.collectorSettlement.findFirst({
        where: { collectorUserId, status: 'OPEN' },
        include: { _count: { select: { receipts: true } } },
      }),
    ]);

    return {
      generatedAt: new Date().toISOString(),
      collectorUserId,
      openSettlementId: openSettlement?.id ?? null,
      clients: clients.map((c) => ({
        ...c,
        outstandingBalance: Number(c.outstandingBalance),
      })),
      bankAccounts,
    };
  },

  /**
   * Sincroniza un cobro emitido en calle (online u offline) de forma 100% idempotente.
   * Asigna número oficial, asienta CREDIT en AccountLedger y suma a la rendición en tránsito.
   */
  async syncReceipt(collectorUserId: number, input: SyncFieldReceiptInput) {
    const breakdown = computeReceiptBreakdown(
      input.payments.map((p) => ({ paymentMethod: p.paymentMethod, amount: p.amount })),
    );

    return prisma.$transaction(async (tx) => {
      const existing = await tx.fieldReceipt.findUnique({
        where: { provisionalCode: input.provisionalCode },
        include: {
          payments: true,
          persona: { select: { id: true, name: true, phone: true, outstandingBalance: true } },
        },
      });
      if (existing) {
        return { receipt: existing, alreadySynced: true };
      }

      const persona = await tx.persona.findUnique({ where: { id: input.personaId } });
      if (!persona || !persona.isClient) {
        throw new AppError('Cliente no encontrado', 404);
      }

      const totalNum = breakdown.totalAmount.toNumber();
      await assertCollectionAllowed(tx, {
        personaId: input.personaId,
        amount: totalNum,
        deliveryRouteId: input.deliveryRouteId ?? null,
        allowCreditOnAccount: false,
      });

      let settlement = await tx.collectorSettlement.findFirst({
        where: { collectorUserId, status: 'OPEN' },
        orderBy: { id: 'desc' },
      });
      if (!settlement) {
        settlement = await tx.collectorSettlement.create({
          data: {
            collectorUserId,
            deliveryRouteId: input.deliveryRouteId ?? null,
            status: 'OPEN',
          },
        });
      }

      const primaryMethod = input.payments[0].paymentMethod as PaymentMethod;

      const createdReceipt = await tx.fieldReceipt.create({
        data: {
          provisionalCode: input.provisionalCode,
          personaId: input.personaId,
          collectorUserId,
          deliveryRouteId: input.deliveryRouteId ?? null,
          billingType: input.billingType as BillingType,
          totalAmount: totalNum,
          status: breakdown.initialReceiptStatus,
          notes: input.notes ?? null,
          gpsLat: input.gpsLat ?? null,
          gpsLng: input.gpsLng ?? null,
          capturedAt: new Date(input.capturedAt),
          settlementId: settlement.id,
        },
      });

      const receiptNumber = `REC-C-${String(createdReceipt.id).padStart(7, '0')}`;

      const transaction = await tx.transaction.create({
        data: {
          personaId: input.personaId,
          userId: collectorUserId,
          billingType: input.billingType as BillingType,
          type: TransactionType.INCOME,
          paymentMethod: primaryMethod,
          amount: totalNum,
          receiptNumber,
          verificationCode: generateUniqueVerificationCode(),
          description: `Cobro digital en calle (${receiptNumber})`,
          verified: false,
        },
      });

      await tx.fieldReceiptPayment.createMany({
        data: input.payments.map((p, idx) => ({
          fieldReceiptId: createdReceipt.id,
          paymentMethod: p.paymentMethod as PaymentMethod,
          amount: breakdown.payments[idx].amount.toNumber(),
          status: breakdown.payments[idx].initialStatus,
          bankAccountId: p.bankAccountId ?? null,
          transferReference: p.transferReference ?? null,
          proofImageUrl: p.proofImageUrl ?? null,
          checkBank: p.checkBank ?? null,
          checkNumber: p.checkNumber ?? null,
          checkIssuerCuit: p.checkIssuerCuit ?? null,
          checkDueDate: p.checkDueDate ? new Date(p.checkDueDate) : null,
          checkFrontImageUrl: p.checkFrontImageUrl ?? null,
          checkBackImageUrl: p.checkBackImageUrl ?? null,
          isEcheq: Boolean(p.isEcheq),
        })),
      });

      await recordLedgerMovement(tx, {
        personaId: input.personaId,
        entryType: LedgerEntryType.CREDIT,
        sourceType: LedgerSourceType.COLLECTION_RECEIPT,
        billingType: input.billingType as BillingType,
        amount: totalNum,
        reference: receiptNumber,
        description: `Recibo digital en calle ${receiptNumber}`,
        transactionId: transaction.id,
        userId: collectorUserId,
        occurredAt: new Date(input.capturedAt),
      });

      const updatedReceipt = await tx.fieldReceipt.update({
        where: { id: createdReceipt.id },
        data: { receiptNumber, transactionId: transaction.id },
        include: {
          payments: true,
          persona: { select: { id: true, name: true, phone: true, outstandingBalance: true } },
          collector: { select: { id: true, username: true } },
        },
      });

      await recomputeOpenSettlement(tx, settlement.id);

      return { receipt: updatedReceipt, alreadySynced: false };
    });
  },

  /**
   * Administración acredita o rechaza una transferencia bancaria recibida en calle.
   */
  async verifyTransferPayment(paymentId: number, adminUserId: number, input: VerifyTransferInput) {
    return prisma.$transaction(async (tx) => {
      const payment = await tx.fieldReceiptPayment.findUnique({
        where: { id: paymentId },
        include: { fieldReceipt: { include: { payments: true } } },
      });
      if (!payment || payment.paymentMethod !== 'BANK_TRANSFER') {
        throw new AppError('Pago por transferencia no encontrado', 404);
      }
      if (payment.status !== 'PENDING_BANK') {
        throw new AppError('Esta transferencia ya fue procesada', 409);
      }

      const amountNum = computeReversalAmount(payment.amount.toString()).toNumber();

      if (input.action === 'CLEAR') {
        const targetBankId = input.bankAccountId ?? payment.bankAccountId;
        if (!targetBankId) {
          throw new AppError('Debe seleccionar la cuenta bancaria de destino', 400);
        }

        await tx.fieldReceiptPayment.update({
          where: { id: payment.id },
          data: { status: 'CLEARED', bankAccountId: targetBankId, verifiedAt: new Date() },
        });

        await tx.bankAccount.update({
          where: { id: targetBankId },
          data: { balance: { increment: amountNum } },
        });

        const hasRemainingPending = payment.fieldReceipt.payments.some(
          (p) => p.id !== payment.id && p.status === 'PENDING_BANK',
        );
        if (!hasRemainingPending && payment.fieldReceipt.status !== 'VOIDED') {
          await tx.fieldReceipt.update({
            where: { id: payment.fieldReceiptId },
            data: { status: 'VERIFIED' },
          });
        }
      } else {
        await tx.fieldReceiptPayment.update({
          where: { id: payment.id },
          data: {
            status: 'REJECTED',
            rejectionReason: input.rejectionReason ?? 'Transferencia no acreditada',
            verifiedAt: new Date(),
          },
        });

        await recordLedgerMovement(tx, {
          personaId: payment.fieldReceipt.personaId,
          entryType: LedgerEntryType.DEBIT,
          sourceType: LedgerSourceType.RECEIPT_REVERSAL,
          billingType: payment.fieldReceipt.billingType,
          amount: amountNum,
          reference: payment.fieldReceipt.receiptNumber ?? payment.fieldReceipt.provisionalCode,
          description: `Rechazo de transferencia (${input.rejectionReason})`,
          userId: adminUserId,
        });
      }

      if (payment.fieldReceipt.settlementId) {
        await recomputeOpenSettlement(tx, payment.fieldReceipt.settlementId);
      }

      return tx.fieldReceipt.findUnique({
        where: { id: payment.fieldReceiptId },
        include: { payments: true },
      });
    });
  },

  /**
   * Tesorería marca un cheque como rechazado y revive la deuda del cliente en AccountLedger.
   */
  async rejectCheckPayment(paymentId: number, adminUserId: number, rejectionReason: string) {
    return prisma.$transaction(async (tx) => {
      const payment = await tx.fieldReceiptPayment.findUnique({
        where: { id: paymentId },
        include: { fieldReceipt: true },
      });
      if (!payment || payment.paymentMethod !== 'CHECK') {
        throw new AppError('Cheque no encontrado', 404);
      }
      if (payment.status === 'REJECTED') {
        throw new AppError('El cheque ya fue rechazado anteriormente', 409);
      }

      const amountNum = computeReversalAmount(payment.amount.toString()).toNumber();

      await tx.fieldReceiptPayment.update({
        where: { id: payment.id },
        data: { status: 'REJECTED', rejectionReason, verifiedAt: new Date() },
      });

      await recordLedgerMovement(tx, {
        personaId: payment.fieldReceipt.personaId,
        entryType: LedgerEntryType.DEBIT,
        sourceType: LedgerSourceType.RECEIPT_REVERSAL,
        billingType: payment.fieldReceipt.billingType,
        amount: amountNum,
        reference: payment.checkNumber ?? payment.fieldReceipt.receiptNumber ?? 'CHEQUE',
        description: `Cheque rechazado N° ${payment.checkNumber ?? 'S/N'} (${rejectionReason})`,
        userId: adminUserId,
      });

      if (payment.fieldReceipt.settlementId) {
        await recomputeOpenSettlement(tx, payment.fieldReceipt.settlementId);
      }

      return { rejected: true, amountReversed: amountNum };
    });
  },

  /**
   * Anulación auditada de un recibo completo (inmutable: nunca se borra).
   */
  async voidFieldReceipt(receiptId: number, adminUserId: number, voidReason: string) {
    return prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "FieldReceipt" WHERE id = ${receiptId} FOR UPDATE`;

      const receipt = await tx.fieldReceipt.findUnique({
        where: { id: receiptId },
        include: { payments: true },
      });
      if (!receipt) {
        throw new AppError('Recibo no encontrado', 404);
      }
      if (receipt.status === 'VOIDED') {
        throw new AppError('El recibo ya se encuentra anulado', 409);
      }

      const activeSumDec = receipt.payments
        .filter((p) => p.status !== 'REJECTED')
        .reduce((acc, p) => acc.plus(roundToIntegerPeso(p.amount.toString())), new Decimal(0));

      if (activeSumDec.gt(0)) {
        await recordLedgerMovement(tx, {
          personaId: receipt.personaId,
          entryType: LedgerEntryType.DEBIT,
          sourceType: LedgerSourceType.RECEIPT_REVERSAL,
          billingType: receipt.billingType,
          amount: computeReversalAmount(activeSumDec).toNumber(),
          reference: receipt.receiptNumber ?? receipt.provisionalCode,
          description: `Anulación de recibo ${receipt.receiptNumber ?? receipt.provisionalCode}: ${voidReason}`,
          userId: adminUserId,
        });
      }

      // Revertir saldo bancario de transferencias que ya habían sido acreditadas (CLEARED)
      for (const payment of receipt.payments) {
        if (
          payment.paymentMethod === PaymentMethod.BANK_TRANSFER &&
          payment.status === 'CLEARED' &&
          payment.bankAccountId
        ) {
          const clearedAmt = roundToIntegerPeso(payment.amount.toString()).toNumber();
          if (clearedAmt > 0) {
            await tx.bankAccount.update({
              where: { id: payment.bankAccountId },
              data: { balance: { decrement: clearedAmt } },
            });
          }
        }
      }

      const mirrorTxId = receipt.transactionId;
      const voided = await tx.fieldReceipt.update({
        where: { id: receipt.id },
        data: {
          status: 'VOIDED',
          voidReason,
          voidedByUserId: adminUserId,
          voidedAt: new Date(),
          transactionId: null,
        },
        include: { payments: true },
      });

      if (mirrorTxId) {
        await tx.transaction.deleteMany({ where: { id: mirrorTxId } });
      }

      if (receipt.settlementId) {
        await recomputeOpenSettlement(tx, receipt.settlementId);
      }

      return voided;
    });
  },

  /**
   * Obtiene rendiciones abiertas/pendientes para el panel de tesorería o del cobrador.
   */
  async listSettlements(collectorUserId?: number) {
    return prisma.collectorSettlement.findMany({
      where: collectorUserId ? { collectorUserId } : undefined,
      include: {
        collector: { select: { id: true, username: true, role: true } },
        receipts: {
          include: {
            persona: { select: { id: true, name: true } },
            payments: true,
          },
          orderBy: { capturedAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  },

  /**
   * Aprueba la rendición diaria del repartidor/vendedor y pasa efectivo/cheques de En Tránsito a Central.
   */
  async approveSettlement(settlementId: number, adminUserId: number, input: ApproveSettlementInput) {
    return prisma.$transaction(async (tx) => {
      const settlement = await tx.collectorSettlement.findUnique({
        where: { id: settlementId },
        include: { receipts: { include: { payments: true } } },
      });
      if (!settlement) {
        throw new AppError('Rendición no encontrada', 404);
      }
      if (settlement.status === 'APPROVED') {
        throw new AppError('Esta rendición ya fue aprobada', 409);
      }

      await recomputeOpenSettlement(tx, settlement.id);
      const refreshed = await tx.collectorSettlement.findUniqueOrThrow({ where: { id: settlement.id } });

      const arqueo = evaluateSettlementArqueo(refreshed.expectedCash.toString(), input.declaredCash);

      // Marca efectivo y cheques IN_TRANSIT como CLEARED al recibirlos en tesorería
      const receiptIds = settlement.receipts
        .filter((r) => r.status !== 'VOIDED')
        .map((r) => r.id);

      if (receiptIds.length > 0) {
        await tx.fieldReceiptPayment.updateMany({
          where: {
            fieldReceiptId: { in: receiptIds },
            paymentMethod: { in: ['CASH', 'CHECK'] },
            status: 'IN_TRANSIT',
          },
          data: { status: 'CLEARED', verifiedAt: new Date() },
        });
      }

      return tx.collectorSettlement.update({
        where: { id: settlement.id },
        data: {
          declaredCash: arqueo.declaredCash.toNumber(),
          cashDifference: arqueo.cashDifference.toNumber(),
          status: arqueo.status,
          approvedByUserId: adminUserId,
          approvedAt: new Date(),
          notes: input.notes ?? null,
        },
      });
    });
  },
};
