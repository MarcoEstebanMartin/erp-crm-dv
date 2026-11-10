import { BillingType, PaymentMethod, TransactionType } from '@prisma/client';
import prisma from '../../utils/prisma';
import AppError from '../../utils/AppError';
import { logAudit } from '../../utils/audit';
import { roundToIntegerPeso, roundToTwoDecimals } from '../../core/money';

export const bankAccountService = {
  async getBankAccounts() {
    return prisma.bankAccount.findMany({ orderBy: { id: 'asc' } });
  },

  async createBankAccount(params: {
    userId: number;
    name: string;
    accountNumber?: string | null;
    balance?: number;
  }) {
    const initialBalance =
      params.balance !== undefined ? roundToTwoDecimals(params.balance).toNumber() : 0;

    const account = await prisma.bankAccount.create({
      data: {
        name: params.name.trim(),
        accountNumber: params.accountNumber ? params.accountNumber.trim() : null,
        balance: initialBalance,
      },
    });

    await logAudit({
      userId: params.userId,
      action: 'CREATE_BANK_ACCOUNT',
      entityType: 'BankAccount',
      entityId: account.id,
      newValues: account,
    });

    return account;
  },

  async updateBankAccount(params: {
    userId: number;
    bankId: number;
    name: string;
    accountNumber?: string | null;
  }) {
    const existing = await prisma.bankAccount.findUnique({ where: { id: params.bankId } });
    if (!existing) {
      throw new AppError('Cuenta bancaria no encontrada.', 404);
    }

    const updatedAccount = await prisma.bankAccount.update({
      where: { id: params.bankId },
      data: {
        name: params.name.trim(),
        accountNumber:
          params.accountNumber !== undefined
            ? params.accountNumber
              ? params.accountNumber.trim()
              : null
            : existing.accountNumber,
      },
    });

    await logAudit({
      userId: params.userId,
      action: 'UPDATE_BANK_ACCOUNT',
      entityType: 'BankAccount',
      entityId: params.bankId,
      oldValues: existing,
      newValues: updatedAccount,
    });

    return updatedAccount;
  },

  async transferFunds(params: {
    userId: number;
    amount: number;
    bankAccountId: number;
    description?: string | null;
  }) {
    const transferAmount = roundToIntegerPeso(params.amount).toNumber();
    if (transferAmount <= 0) {
      throw new AppError('El monto de transferencia debe ser mayor a cero.', 400);
    }

    const [drawer, targetBank] = await Promise.all([
      prisma.cashDrawer.findFirst({ where: { userId: params.userId, status: 'OPEN' } }),
      prisma.bankAccount.findUnique({ where: { id: Number(params.bankAccountId) } }),
    ]);

    if (!drawer) {
      throw new AppError(
        'No tenés ninguna caja abierta. Abrí una caja antes de transferir efectivo.',
        400,
      );
    }
    if (!targetBank) {
      throw new AppError('La cuenta bancaria de destino no existe.', 404);
    }

    const billing = drawer.branch === 'A' ? BillingType.OFFICIAL : BillingType.INTERNAL;

    const result = await prisma.$transaction(async (tx) => {
      const outcomeTrans = await tx.transaction.create({
        data: {
          userId: params.userId,
          billingType: billing,
          type: TransactionType.OUTCOME,
          paymentMethod: PaymentMethod.CASH,
          amount: transferAmount,
          description: params.description || 'Depósito de efectivo a cuenta de banco',
          cashDrawerId: drawer.id,
          verified: true,
        },
      });

      const incomeTrans = await tx.transaction.create({
        data: {
          userId: params.userId,
          billingType: billing,
          type: TransactionType.INCOME,
          paymentMethod: PaymentMethod.BANK_TRANSFER,
          amount: transferAmount,
          description: params.description || 'Depósito recibido desde caja',
          bankAccountId: targetBank.id,
          verified: true,
        },
      });

      const updatedBank = await tx.bankAccount.update({
        where: { id: targetBank.id },
        data: { balance: { increment: transferAmount } },
      });

      return { outcomeTrans, incomeTrans, updatedBank };
    });

    await logAudit({
      userId: params.userId,
      action: 'DEPOSIT_CASH_TO_BANK',
      entityType: 'BankAccount',
      entityId: targetBank.id,
      newValues: {
        cashDrawerId: drawer.id,
        amount: transferAmount,
        bankAccountName: result.updatedBank.name,
      },
    });

    return result;
  },
};
