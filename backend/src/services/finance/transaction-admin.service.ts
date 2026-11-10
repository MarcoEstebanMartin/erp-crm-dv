import { BillingType, PaymentMethod, TransactionType } from '@prisma/client';
import prisma from '../../utils/prisma';
import AppError from '../../utils/AppError';
import { logAudit } from '../../utils/audit';
import { roundToIntegerPeso } from '../../core/money';
import { calculateVerificationDeltas } from '../../engines/drawer-arqueo.engine';

export const transactionAdminService = {
  async getTransactions(query: {
    branch?: string;
    cashDrawerId?: string;
    bankAccountId?: string;
    startDate?: string;
    endDate?: string;
    paymentMethod?: string;
    verified?: string;
  }) {
    const whereClause: Record<string, any> = {};

    if (query.branch) {
      whereClause.billingType = query.branch === 'A' ? BillingType.OFFICIAL : BillingType.INTERNAL;
    }
    if (query.cashDrawerId) whereClause.cashDrawerId = Number(query.cashDrawerId);
    if (query.bankAccountId) whereClause.bankAccountId = Number(query.bankAccountId);
    if (query.paymentMethod) whereClause.paymentMethod = String(query.paymentMethod);
    if (query.verified !== undefined) whereClause.verified = query.verified === 'true';

    if (query.startDate || query.endDate) {
      whereClause.createdAt = {};
      if (query.startDate) whereClause.createdAt.gte = new Date(String(query.startDate));
      if (query.endDate) whereClause.createdAt.lte = new Date(String(query.endDate));
    }

    return prisma.transaction.findMany({
      where: whereClause,
      include: {
        user: { select: { id: true, username: true } },
        persona: { select: { id: true, name: true, isClient: true, isProvider: true } },
        cashDrawer: true,
        bankAccount: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  },

  async getTransactionById(id: number) {
    if (isNaN(id)) throw new AppError('ID de transacción inválido.', 400);

    const transaction = await prisma.transaction.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, username: true } },
        persona: { select: { id: true, name: true, isClient: true, isProvider: true } },
        cashDrawer: true,
        bankAccount: true,
        order: { select: { id: true, invoiceNumber: true } },
      },
    });
    if (!transaction) throw new AppError('Transacción no encontrada.', 404);
    return transaction;
  },

  async verifyTransaction(params: {
    userId: number;
    txId: number;
    verified: boolean;
    adjustedAmount?: number | null;
  }) {
    const transaction = await prisma.transaction.findUnique({ where: { id: params.txId } });
    if (!transaction) throw new AppError('Transacción no encontrada.', 404);

    const updatedTx = await prisma.$transaction(async (tx) => {
      let resolvedBankAccountId = transaction.bankAccountId;
      if (
        !resolvedBankAccountId &&
        Boolean(params.verified) &&
        transaction.type === TransactionType.INCOME &&
        (transaction.paymentMethod === PaymentMethod.BANK_TRANSFER ||
          transaction.paymentMethod === PaymentMethod.CHECK)
      ) {
        const defaultBank = await tx.bankAccount.findFirst();
        resolvedBankAccountId = defaultBank?.id ?? null;
      }

      const deltas = calculateVerificationDeltas({
        oldAmount: transaction.amount.toString(),
        verifiedBefore: transaction.verified,
        verifiedAfter: Boolean(params.verified),
        adjustedAmount: params.adjustedAmount,
        type: transaction.type,
        hasPersona: Boolean(transaction.personaId),
        hasBankAccount: Boolean(resolvedBankAccountId),
      });

      if (transaction.personaId && deltas.personaDecrementDelta !== 0) {
        await tx.persona.update({
          where: { id: transaction.personaId },
          data: { outstandingBalance: { decrement: deltas.personaDecrementDelta } },
        });
      }

      if (resolvedBankAccountId && deltas.bankIncrementDelta !== 0) {
        await tx.bankAccount.update({
          where: { id: resolvedBankAccountId },
          data: { balance: { increment: deltas.bankIncrementDelta } },
        });
      }

      return tx.transaction.update({
        where: { id: params.txId },
        data: {
          verified: Boolean(params.verified),
          amount: deltas.finalAmount,
          bankAccountId: resolvedBankAccountId,
        },
        include: {
          user: { select: { id: true, username: true } },
          persona: { select: { id: true, name: true, isClient: true, isProvider: true } },
          cashDrawer: true,
          bankAccount: true,
        },
      });
    });

    await logAudit({
      userId: params.userId,
      action: 'VERIFY_BANK_TRANSFER',
      entityType: 'Transaction',
      entityId: params.txId,
      newValues: {
        verified: Boolean(params.verified),
        amount: updatedTx.amount,
        originalAmount: transaction.amount,
        bankAccountId: updatedTx.bankAccountId,
        adjusted: params.adjustedAmount !== undefined && params.adjustedAmount !== null,
      },
    });

    return updatedTx;
  },

  async createCentralExpense(params: {
    userId: number;
    amount: number;
    description: string;
    paymentMethod?: string;
    billingType?: string;
  }) {
    const expAmount = roundToIntegerPeso(params.amount).toNumber();
    if (expAmount <= 0) throw new AppError('El monto del gasto debe ser mayor a 0.', 400);

    const transaction = await prisma.transaction.create({
      data: {
        userId: params.userId,
        type: TransactionType.OUTCOME,
        paymentMethod: (params.paymentMethod as PaymentMethod) || PaymentMethod.CASH,
        billingType: (params.billingType as BillingType) || BillingType.INTERNAL,
        amount: expAmount,
        description: params.description.trim(),
        verified: true,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: params.userId,
        action: 'CREATE_EXPENSE',
        entityType: 'Transaction',
        entityId: transaction.id,
        newValues: {
          amount: expAmount,
          description: params.description.trim(),
          paymentMethod: transaction.paymentMethod,
          billingType: transaction.billingType,
        },
      },
    });

    return transaction;
  },
};
