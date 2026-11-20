import {
  BillingType,
  LedgerEntryType,
  LedgerSourceType,
  PaymentMethod,
  TransactionType,
} from '@prisma/client';
import prisma from '../utils/prisma';
import AppError from '../utils/AppError';
import {
  computeReceiptBreakdown,
  computeReversalAmount,
  evaluateSettlementArqueo,
  splitImmediateAndDeferredPayments,
} from '../engines/fieldReceipts.engine';
import { recordLedgerMovement } from './ledger/account-ledger.service';
import { assertCollectionAllowed } from './collections/collection-guard.service';
import {
  applyTransferClearAndIssueReceipt,
  createSettlementCashDrawerAndLinkMirrors,
  recomputeOpenSettlement,
  syncMirrorTransactionForFieldReceipt,
  voidFieldReceiptAndReverse,
} from './collections/field-receipt-mirror.helper';
import { generateUniqueVerificationCode } from '../core/receiptToken';
import {
  ApproveSettlementInput,
  SyncFieldReceiptInput,
  VerifyTransferInput,
} from '../validators/fieldReceipts.schema';

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
        allowCreditOnAccount: Boolean(input.allowCreditOnAccount),
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

      const split = splitImmediateAndDeferredPayments(breakdown.payments);
      const immediateNum = split.immediateAmount.toNumber();
      const createdReceipt = await tx.fieldReceipt.create({
        data: {
          provisionalCode: input.provisionalCode,
          personaId: input.personaId,
          collectorUserId,
          deliveryRouteId: input.deliveryRouteId ?? null,
          billingType: input.billingType as BillingType,
          totalAmount: split.hasImmediate ? immediateNum : totalNum,
          status: split.hasImmediate ? breakdown.initialReceiptStatus : 'PENDING_VERIFICATION',
          notes: input.notes ?? null,
          gpsLat: input.gpsLat ?? null,
          gpsLng: input.gpsLng ?? null,
          capturedAt: new Date(input.capturedAt),
          settlementId: settlement.id,
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

      if (split.hasImmediate) {
        const primaryImmediateMethod = split.immediatePayments[0].paymentMethod as PaymentMethod;
        const receiptNumber = `REC-C-${String(createdReceipt.id).padStart(7, '0')}`;

        const transaction = await tx.transaction.create({
          data: {
            personaId: input.personaId,
            userId: collectorUserId,
            billingType: input.billingType as BillingType,
            type: TransactionType.INCOME,
            paymentMethod: primaryImmediateMethod,
            amount: immediateNum,
            receiptNumber,
            verificationCode: generateUniqueVerificationCode(),
            description: `Cobro digital en calle (${receiptNumber})`,
            verified: false,
          },
        });

        await recordLedgerMovement(tx, {
          personaId: input.personaId,
          entryType: LedgerEntryType.CREDIT,
          sourceType: LedgerSourceType.COLLECTION_RECEIPT,
          billingType: input.billingType as BillingType,
          amount: immediateNum,
          reference: receiptNumber,
          description: `Recibo digital en calle ${receiptNumber}`,
          transactionId: transaction.id,
          userId: collectorUserId,
          occurredAt: new Date(input.capturedAt),
        });

        await tx.fieldReceipt.update({
          where: { id: createdReceipt.id },
          data: { receiptNumber, transactionId: transaction.id },
        });
      }

      await recomputeOpenSettlement(tx, settlement.id);

      const syncedReceipt = await tx.fieldReceipt.findUniqueOrThrow({
        where: { id: createdReceipt.id },
        include: {
          payments: true,
          persona: { select: { id: true, name: true, phone: true, outstandingBalance: true } },
          collector: { select: { id: true, username: true } },
        },
      });

      return { receipt: syncedReceipt, alreadySynced: false };
    });
  },

  /**
   * Administración acredita o rechaza una transferencia bancaria recibida en calle.
   */
  async verifyTransferPayment(paymentId: number, adminUserId: number, input: VerifyTransferInput) {
    return prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "FieldReceiptPayment" WHERE id = ${paymentId} FOR UPDATE`;

      const payment = await tx.fieldReceiptPayment.findUnique({
        where: { id: paymentId },
        include: { fieldReceipt: { include: { payments: true } } },
      });
      if (!payment || payment.paymentMethod !== 'BANK_TRANSFER') {
        throw new AppError('Pago por transferencia no encontrado', 404);
      }
      if (payment.fieldReceipt.status === 'VOIDED') {
        throw new AppError('El recibo fue anulado y no puede acreditarse', 409);
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

        await applyTransferClearAndIssueReceipt(tx, {
          payment: { id: payment.id, fieldReceiptId: payment.fieldReceiptId },
          receipt: payment.fieldReceipt,
          targetBankId,
          amountNum,
          adminUserId,
          now: new Date(),
        });
      } else {
        await tx.fieldReceiptPayment.update({
          where: { id: payment.id },
          data: {
            status: 'REJECTED',
            rejectionReason: input.rejectionReason ?? 'Transferencia no acreditada',
            verifiedAt: new Date(),
          },
        });

        await syncMirrorTransactionForFieldReceipt(tx, payment.fieldReceiptId, adminUserId);
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
      if (typeof tx.$queryRaw === 'function') {
        await tx.$queryRaw`SELECT id FROM "FieldReceiptPayment" WHERE id = ${paymentId} FOR UPDATE`;
      }

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

      await syncMirrorTransactionForFieldReceipt(tx, payment.fieldReceiptId, adminUserId);

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

      return voidFieldReceiptAndReverse(tx, receipt, adminUserId, voidReason);
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
      if (typeof tx.$queryRaw === 'function') {
        await tx.$queryRaw`SELECT id FROM "CollectorSettlement" WHERE id = ${settlementId} FOR UPDATE`;
      }

      const settlement = await tx.collectorSettlement.findUnique({
        where: { id: settlementId },
        include: {
          collector: { select: { id: true, username: true, role: true } },
          deliveryRoute: { select: { id: true, driverName: true, vehiclePlate: true } },
          receipts: { include: { payments: true } },
        },
      });
      if (!settlement) {
        throw new AppError('Rendición no encontrada', 404);
      }
      if (settlement.status === 'APPROVED' || settlement.status === 'DISCREPANCY') {
        throw new AppError('Esta rendición ya fue aprobada y cerrada', 409);
      }

      await recomputeOpenSettlement(tx, settlement.id);
      const refreshed = await tx.collectorSettlement.findUniqueOrThrow({ where: { id: settlement.id } });

      const arqueo = evaluateSettlementArqueo(refreshed.expectedCash.toString(), input.declaredCash);

      // Marca efectivo y cheques IN_TRANSIT como CLEARED al recibirlos en tesorería
      const activeReceipts = settlement.receipts.filter((r) => r.status !== 'VOIDED');
      const receiptIds = activeReceipts.map((r) => r.id);

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

      await createSettlementCashDrawerAndLinkMirrors(tx, {
        settlementId: settlement.id,
        collectorUserId: settlement.collectorUserId,
        collector: settlement.collector,
        deliveryRouteId: settlement.deliveryRouteId,
        deliveryRoute: settlement.deliveryRoute,
        activeReceipts,
        expectedCash: refreshed.expectedCash.toString(),
        expectedChecksAmount: refreshed.expectedChecksAmount.toString(),
        declaredCash: arqueo.declaredCash.toNumber(),
        cashDifference: arqueo.cashDifference.toNumber(),
        settlementStatus: arqueo.status,
        settlementCreatedAt: settlement.createdAt,
        adminUserId,
        notes: input.notes ?? null,
      });

      for (const receipt of activeReceipts) {
        await syncMirrorTransactionForFieldReceipt(tx, receipt.id, adminUserId);
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
