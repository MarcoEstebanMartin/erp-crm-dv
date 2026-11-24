import { BillingType, PaymentMethod, TransactionType } from '@prisma/client';
import prisma from '../../utils/prisma';
import AppError from '../../utils/AppError';
import { NumericInput, roundToIntegerPeso } from '../../core/money';

export interface AdvanceFilters {
  employeeId?: string;
  status?: string;
  month?: string;
  year?: string;
}

export interface CreateAdvanceInput {
  employeeId: number | string;
  amount: NumericInput;
  date?: string | Date | null;
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
    if (filters.month && filters.year) {
      const m = Number(filters.month);
      const y = Number(filters.year);
      where.date = {
        gte: new Date(y, m - 1, 1, 0, 0, 0, 0),
        lt: new Date(y, m, 1, 0, 0, 0, 0),
      };
    }

    return prisma.salaryAdvance.findMany({
      where,
      include: {
        employee: {
          select: { id: true, firstName: true, lastName: true, dni: true, position: true },
        },
        cashDrawer: { select: { id: true, branch: true, openedAt: true, status: true } },
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

    const advanceDec = roundToIntegerPeso(input.amount);
    if (advanceDec.lte(0)) {
      throw new AppError('El monto del retiro debe ser mayor a cero', 400);
    }

    const employee = await prisma.employee.findUnique({ where: { id: empId } });
    if (!employee) {
      throw new AppError('Empleado no encontrado', 404);
    }

    const parsedDrawerId = input.cashDrawerId ? Number(input.cashDrawerId) : null;
    const parsedBankId = input.bankAccountId ? Number(input.bankAccountId) : null;
    if (!parsedDrawerId && !parsedBankId) {
      throw new AppError('Debés seleccionar una Caja abierta o una Cuenta Bancaria para descontar el retiro.', 400);
    }

    const method = (input.paymentMethod as PaymentMethod) || (parsedBankId ? PaymentMethod.BANK_TRANSFER : PaymentMethod.CASH);
    const advanceAmount = advanceDec.toNumber();
    const userId = input.actorUserId || 1;
    const advanceDate = input.date ? new Date(input.date) : new Date();
    const reasonText = input.reason?.trim() || 'Retiro del mes';

    return prisma.$transaction(async (tx) => {
      if (parsedDrawerId) {
        const drawer = await tx.cashDrawer.findUnique({
          where: { id: parsedDrawerId },
          select: { id: true, status: true },
        });
        if (!drawer) {
          throw new AppError('Caja operativa no encontrada', 404);
        }
        if (drawer.status !== 'OPEN') {
          throw new AppError('La caja seleccionada ya se encuentra cerrada.', 400);
        }
      }

      if (parsedBankId) {
        const bank = await tx.bankAccount.findUnique({
          where: { id: parsedBankId },
          select: { id: true },
        });
        if (!bank) {
          throw new AppError('Cuenta bancaria no encontrada', 404);
        }
      }

      let category = await tx.expenseCategory.findUnique({ where: { name: 'Sueldos' } });
      if (!category) {
        category = await tx.expenseCategory.create({
          data: { name: 'Sueldos', description: 'Sueldos de personal, retiros y adelantos' },
        });
      }

      const financialTx = await tx.transaction.create({
        data: {
          userId,
          billingType: BillingType.INTERNAL,
          type: TransactionType.OUTCOME,
          paymentMethod: method,
          amount: advanceAmount,
          description: `Retiro: ${employee.lastName}, ${employee.firstName}${input.reason?.trim() ? ` - ${input.reason.trim()}` : ''}`,
          cashDrawerId: parsedDrawerId,
          bankAccountId: parsedBankId,
          verified: true,
        },
      });

      if (parsedBankId) {
        await tx.bankAccount.update({
          where: { id: parsedBankId },
          data: { balance: { decrement: advanceAmount } },
        });
      }

      await tx.expense.create({
        data: {
          amount: advanceAmount,
          date: advanceDate,
          description: `Retiro: ${employee.lastName}, ${employee.firstName}${input.reason?.trim() ? ` - ${input.reason.trim()}` : ''}`,
          categoryId: category.id,
          userId,
          paymentMethod: method,
          cashDrawerId: parsedDrawerId,
          bankAccountId: parsedBankId,
          transactionId: financialTx.id,
        },
      });

      return tx.salaryAdvance.create({
        data: {
          employeeId: empId,
          amount: advanceAmount,
          date: advanceDate,
          reason: reasonText,
          paymentMethod: method,
          cashDrawerId: parsedDrawerId,
          bankAccountId: parsedBankId,
          transactionId: financialTx.id,
        },
        include: {
          employee: true,
          cashDrawer: { select: { id: true, branch: true, status: true } },
          bankAccount: { select: { id: true, name: true } },
        },
      });
    });
  },

  async deleteAdvance(id: number) {
    if (!Number.isInteger(id) || id <= 0) {
      throw new AppError('ID de retiro inválido', 400);
    }

    return prisma.$transaction(async (tx) => {
      const advance = await tx.salaryAdvance.findUnique({
        where: { id },
        include: { cashDrawer: { select: { id: true, status: true } } },
      });
      if (!advance) {
        throw new AppError('Retiro no encontrado', 404);
      }
      if (advance.cashDrawer && advance.cashDrawer.status !== 'OPEN') {
        throw new AppError('No se puede eliminar un retiro de una caja ya cerrada.', 400);
      }

      const amountNum = roundToIntegerPeso(advance.amount).toNumber();

      if (advance.bankAccountId) {
        await tx.bankAccount.update({
          where: { id: advance.bankAccountId },
          data: { balance: { increment: amountNum } },
        });
      }

      if (advance.transactionId) {
        await tx.expense.deleteMany({ where: { transactionId: advance.transactionId } });
      }

      await tx.salaryAdvance.delete({ where: { id } });

      if (advance.transactionId) {
        await tx.transaction.delete({ where: { id: advance.transactionId } });
      }

      return { id };
    });
  },
};
