import {
  BillingType,
  LedgerEntryType,
  LedgerSourceType,
  PaymentMethod,
  TransactionType,
} from '@prisma/client';
import prisma from '../../utils/prisma';
import AppError from '../../utils/AppError';
import { logAudit } from '../../utils/audit';
import { roundToIntegerPeso } from '../../core/money';
import { calculateVerificationDeltas } from '../../engines/drawer-arqueo.engine';
import { recordLedgerMovement } from '../ledger/account-ledger.service';
import { resolveExpenseCategoryId } from '../expenses/expense-category.helper';

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
        user: {
          select: {
            id: true,
            username: true,
            employee: { select: { firstName: true, lastName: true } },
          },
        },
        verifiedBy: { select: { id: true, username: true } },
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
        user: {
          select: {
            id: true,
            username: true,
            employee: { select: { firstName: true, lastName: true } },
          },
        },
        verifiedBy: { select: { id: true, username: true } },
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
    bankAccountId?: number | null;
  }) {
    const transaction = await prisma.transaction.findUnique({
      where: { id: params.txId },
      include: { fieldReceipt: { select: { id: true, receiptNumber: true } } },
    });
    if (!transaction) throw new AppError('Transacción no encontrada.', 404);
    if (transaction.fieldReceipt) {
      const receiptLabel =
        transaction.fieldReceipt.receiptNumber || `#${transaction.fieldReceipt.id}`;
      throw new AppError(
        `Este cobro pertenece al recibo digital en calle ${receiptLabel}. Gestionalo desde Rendiciones para evitar duplicar acreditaciones.`,
        409,
      );
    }

    const updatedTx = await prisma.$transaction(async (tx) => {
      let resolvedBankAccountId = transaction.bankAccountId;
      if (
        !resolvedBankAccountId &&
        Boolean(params.verified) &&
        transaction.type === TransactionType.INCOME &&
        (transaction.paymentMethod === PaymentMethod.BANK_TRANSFER ||
          transaction.paymentMethod === PaymentMethod.CHECK)
      ) {
        if (params.bankAccountId) {
          resolvedBankAccountId = Number(params.bankAccountId);
        } else {
          const defaultBank = await tx.bankAccount.findFirst();
          resolvedBankAccountId = defaultBank?.id ?? null;
        }
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
        const isCredit = deltas.personaDecrementDelta > 0;
        await recordLedgerMovement(tx, {
          personaId: transaction.personaId,
          entryType: isCredit ? LedgerEntryType.CREDIT : LedgerEntryType.DEBIT,
          sourceType: LedgerSourceType.RECONCILIATION_ADJUSTMENT,
          billingType: transaction.billingType,
          amount: Math.abs(deltas.personaDecrementDelta),
          transactionId: transaction.id,
          orderId: transaction.orderId,
          reference: `Ajuste Recibo #${transaction.id}`,
          description: `Ajuste de conciliación en movimiento #${transaction.id}`,
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
          verifiedById: params.verified ? params.userId : null,
          verifiedAt: params.verified ? new Date() : null,
          amount: deltas.finalAmount,
          bankAccountId: resolvedBankAccountId,
        },
        include: {
          user: { select: { id: true, username: true } },
          verifiedBy: { select: { id: true, username: true } },
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
    cashSource?: 'CAJA_GRANDE' | 'CAJA_OFICINA';
  }) {
    const expAmount = roundToIntegerPeso(params.amount).toNumber();
    if (expAmount <= 0) throw new AppError('El monto del gasto debe ser mayor a 0.', 400);

    const resolvedSource = params.cashSource === 'CAJA_OFICINA' ? 'CAJA_OFICINA' : 'CAJA_GRANDE';
    let cashDrawerId: number | null = null;

    if (resolvedSource === 'CAJA_OFICINA') {
      const oficinaDrawer = await prisma.cashDrawer.findFirst({
        where: {
          status: 'OPEN',
          OR: [{ branch: 'DEPOSITO' }, { drawerType: 'DEPOSITO' }],
        },
        orderBy: { openedAt: 'desc' },
      });
      if (!oficinaDrawer) {
        throw new AppError(
          'No hay una Caja Oficina abierta. Abrí Caja Oficina para registrar gastos desde ella.',
          400,
        );
      }
      cashDrawerId = oficinaDrawer.id;
    }

    const cleanDesc = params.description.trim();
    const resolvedMethod = (params.paymentMethod as PaymentMethod) || PaymentMethod.CASH;

    const transaction = await prisma.transaction.create({
      data: {
        userId: params.userId,
        type: TransactionType.OUTCOME,
        paymentMethod: resolvedMethod,
        billingType: (params.billingType as BillingType) || BillingType.INTERNAL,
        amount: expAmount,
        description: cleanDesc,
        cashDrawerId,
        verified: true,
      },
    });

    // Sincronización automática con la Planilla de Gastos (apuntando al mismo transactionId)
    const categoryId = await resolveExpenseCategoryId(prisma as any, cleanDesc);
    if (categoryId) {
      await prisma.expense.create({
        data: {
          amount: expAmount,
          date: new Date(),
          description: cleanDesc,
          categoryId,
          userId: params.userId,
          paymentMethod: resolvedMethod,
          cashDrawerId: cashDrawerId ?? undefined,
          transactionId: transaction.id,
        },
      });
    }

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
          cashSource: resolvedSource,
          cashDrawerId,
        },
      },
    });

    return transaction;
  },
};
