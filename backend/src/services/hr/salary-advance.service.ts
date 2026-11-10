import { BillingType, PaymentMethod, TransactionType } from '@prisma/client';
import prisma from '../../utils/prisma';
import AppError from '../../utils/AppError';
import { NumericInput, roundToTwoDecimals } from '../../core/money';

export interface AdvanceFilters {
  employeeId?: string;
  status?: string;
}

export interface CreateAdvanceInput {
  employeeId: number | string;
  amount: NumericInput;
  reason?: string | null;
  paymentMethod?: PaymentMethod | string | null;
  cashDrawerId?: number | string | null;
  bankAccountId?: number | string | null;
  actorUserId?: number;
}

export const salaryAdvanceService = {
  async getAdvances(filters: AdvanceFilters) {
    const where: Record<string, unknown> = {};

    if (filters.employeeId) {
      where.employeeId = Number(filters.employeeId);
    }
    if (filters.status) {
      where.status = filters.status;
    }

    return prisma.salaryAdvance.findMany({
      where,
      include: {
        employee: {
          select: { id: true, firstName: true, lastName: true, dni: true, position: true },
        },
        cashDrawer: { select: { id: true, branch: true, openedAt: true } },
        bankAccount: { select: { id: true, name: true } },
        transaction: { select: { id: true, receiptNumber: true, amount: true } },
      },
      orderBy: { date: 'desc' },
    });
  },

  async createAdvance(input: CreateAdvanceInput) {
    const empId = Number(input.employeeId);
    if (!Number.isInteger(empId) || empId <= 0 || input.amount === undefined || input.amount === null) {
      throw new AppError('Empleado y monto válido son requeridos', 400);
    }

    const advanceDec = roundToTwoDecimals(input.amount);
    if (advanceDec.lte(0)) {
      throw new AppError('Empleado y monto válido son requeridos', 400);
    }

    const employee = await prisma.employee.findUnique({ where: { id: empId } });
    if (!employee) {
      throw new AppError('Empleado no encontrado', 404);
    }

    const parsedDrawerId = input.cashDrawerId ? Number(input.cashDrawerId) : null;
    const parsedBankId = input.bankAccountId ? Number(input.bankAccountId) : null;
    const method = (input.paymentMethod as PaymentMethod) || PaymentMethod.CASH;
    const advanceAmount = advanceDec.toNumber();
    const userId = input.actorUserId || 1;

    return prisma.$transaction(async (tx) => {
      let transactionId: number | null = null;

      if (parsedDrawerId || parsedBankId) {
        if (parsedDrawerId) {
          const drawer = await tx.cashDrawer.findUnique({
            where: { id: parsedDrawerId },
            select: { id: true },
          });
          if (!drawer) {
            throw new AppError('Caja operativa no encontrada', 404);
          }
        }

        let category = await tx.expenseCategory.findUnique({ where: { name: 'Sueldos' } });
        if (!category) {
          category = await tx.expenseCategory.create({
            data: { name: 'Sueldos', description: 'Sueldos de personal, adelantos y comisiones' },
          });
        }

        const financialTx = await tx.transaction.create({
          data: {
            userId,
            billingType: BillingType.INTERNAL,
            type: TransactionType.OUTCOME,
            paymentMethod: method,
            amount: advanceAmount,
            description: `Adelanto de Sueldo: ${employee.lastName}, ${employee.firstName} - ${input.reason || 'Adelanto'}`,
            cashDrawerId: parsedDrawerId,
            bankAccountId: parsedBankId,
            verified: true,
          },
        });

        transactionId = financialTx.id;

        if (parsedBankId) {
          await tx.bankAccount.update({
            where: { id: parsedBankId },
            data: { balance: { decrement: advanceAmount } },
          });
        }

        await tx.expense.create({
          data: {
            amount: advanceAmount,
            description: `Adelanto de Sueldo: ${employee.lastName}, ${employee.firstName}`,
            categoryId: category.id,
            userId,
            paymentMethod: method,
            cashDrawerId: parsedDrawerId,
            bankAccountId: parsedBankId,
            transactionId: financialTx.id,
          },
        });
      }

      return tx.salaryAdvance.create({
        data: {
          employeeId: empId,
          amount: advanceAmount,
          reason: input.reason || 'Adelanto de sueldo',
          paymentMethod: method,
          cashDrawerId: parsedDrawerId,
          bankAccountId: parsedBankId,
          transactionId,
        },
        include: {
          employee: true,
        },
      });
    });
  },
};
