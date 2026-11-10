import { BillingType, PaymentMethod, TransactionType } from '@prisma/client';
import prisma from '../../utils/prisma';
import AppError from '../../utils/AppError';
import { NumericInput, roundToIntegerPeso, roundToTwoDecimals, toDecimal } from '../../core/money';
import { SAFE_EMPLOYEE_USER_SELECT } from './employee.service';

export interface CalculatePayrollParams {
  employeeId?: string;
  periodMonth?: string;
  periodYear?: string;
}

export interface CreatePayrollInput {
  employeeId: number | string;
  periodMonth: number | string;
  periodYear: number | string;
  baseSalary: NumericInput;
  commissions?: NumericInput;
  overtimeAmount?: NumericInput;
  bonuses?: NumericInput;
  advancesDeduction?: NumericInput;
  otherDeductions?: NumericInput;
  paymentMethod?: PaymentMethod | string | null;
  cashDrawerId?: number | string | null;
  bankAccountId?: number | string | null;
  notes?: string | null;
  actorUserId?: number;
}

const SELLER_COMMISSION_RATE = '0.015';

export function computePayrollBreakdown(params: {
  baseSalary: NumericInput;
  commissions?: NumericInput;
  overtimeAmount?: NumericInput;
  bonuses?: NumericInput;
  advancesDeduction?: NumericInput;
  otherDeductions?: NumericInput;
}) {
  const base = roundToTwoDecimals(params.baseSalary);
  const comms = roundToTwoDecimals(params.commissions ?? 0);
  const overtime = roundToTwoDecimals(params.overtimeAmount ?? 0);
  const bonus = roundToTwoDecimals(params.bonuses ?? 0);
  const advDeduction = roundToTwoDecimals(params.advancesDeduction ?? 0);
  const otherDeducts = roundToTwoDecimals(params.otherDeductions ?? 0);
  const grossSalary = roundToTwoDecimals(base.plus(comms).plus(overtime).plus(bonus));
  const netSalary = roundToTwoDecimals(grossSalary.minus(advDeduction).minus(otherDeducts));
  return { base, comms, overtime, bonus, advDeduction, otherDeducts, grossSalary, netSalary };
}

export const payrollService = {
  async calculatePayroll(query: CalculatePayrollParams) {
    if (!query.employeeId || !query.periodMonth || !query.periodYear) {
      throw new AppError('employeeId, periodMonth y periodYear son requeridos', 400);
    }

    const empId = Number(query.employeeId);
    const month = Number(query.periodMonth);
    const year = Number(query.periodYear);

    const employee = await prisma.employee.findUnique({
      where: { id: empId },
      include: { user: { select: SAFE_EMPLOYEE_USER_SELECT } },
    });
    if (!employee) throw new AppError('Empleado no encontrado', 404);

    const pendingAdvances = await prisma.salaryAdvance.findMany({
      where: { employeeId: empId, status: 'PENDING' },
    });
    const totalAdvancesDec = pendingAdvances.reduce(
      (acc, curr) => acc.plus(roundToTwoDecimals(curr.amount)),
      toDecimal(0),
    );

    let suggestedCommissionsDec = toDecimal(0);
    if (employee.userId) {
      const salesSummary = await prisma.order.aggregate({
        where: {
          sellerId: employee.userId,
          createdAt: { gte: new Date(year, month - 1, 1), lte: new Date(year, month, 0, 23, 59, 59) },
          status: { in: ['PREPARED', 'DELIVERED'] },
        },
        _sum: { totalAmount: true },
      });
      const totalSalesDec = toDecimal(salesSummary._sum.totalAmount ?? 0);
      if (employee.position.toLowerCase().includes('vendedor')) {
        suggestedCommissionsDec = roundToIntegerPeso(totalSalesDec.times(SELLER_COMMISSION_RATE));
      }
    }

    const baseSalaryDec = roundToTwoDecimals(employee.baseSalary);
    const grossSalaryDec = roundToTwoDecimals(baseSalaryDec.plus(suggestedCommissionsDec));
    const netSalaryDec = roundToTwoDecimals(grossSalaryDec.minus(totalAdvancesDec));

    return {
      employee,
      periodMonth: month,
      periodYear: year,
      baseSalary: baseSalaryDec.toNumber(),
      suggestedCommissions: suggestedCommissionsDec.toNumber(),
      pendingAdvances,
      totalAdvances: roundToTwoDecimals(totalAdvancesDec).toNumber(),
      grossSalary: grossSalaryDec.toNumber(),
      netSalary: netSalaryDec.toNumber(),
    };
  },

  async createPayroll(input: CreatePayrollInput) {
    if (!input.employeeId || !input.periodMonth || !input.periodYear || input.baseSalary === undefined) {
      throw new AppError('Empleado, Período (Mes/Año) y Sueldo Básico son requeridos', 400);
    }

    const empId = Number(input.employeeId);
    const month = Number(input.periodMonth);
    const year = Number(input.periodYear);
    const breakdown = computePayrollBreakdown(input);
    if (breakdown.netSalary.lt(0)) {
      throw new AppError('El sueldo neto resultante no puede ser negativo', 400);
    }

    const employee = await prisma.employee.findUnique({ where: { id: empId } });
    if (!employee) throw new AppError('Empleado no encontrado', 404);

    const existing = await prisma.payroll.findUnique({
      where: { employeeId_periodMonth_periodYear: { employeeId: empId, periodMonth: month, periodYear: year } },
    });
    if (existing) {
      throw new AppError(`Ya existe una liquidación para este empleado en el período ${month}/${year}`, 400);
    }

    const parsedDrawerId = input.cashDrawerId ? Number(input.cashDrawerId) : null;
    const parsedBankId = input.bankAccountId ? Number(input.bankAccountId) : null;
    const isPaidNow = Boolean(parsedDrawerId || parsedBankId);
    const method = (input.paymentMethod as PaymentMethod) || PaymentMethod.BANK_TRANSFER;
    const netAmount = breakdown.netSalary.toNumber();
    const userId = input.actorUserId || 1;

    return prisma.$transaction(async (tx) => {
      let transactionId: number | null = null;

      if (isPaidNow) {
        if (parsedDrawerId) {
          const drawer = await tx.cashDrawer.findUnique({ where: { id: parsedDrawerId }, select: { id: true } });
          if (!drawer) throw new AppError('Caja operativa no encontrada', 404);
        }
        const category =
          (await tx.expenseCategory.findUnique({ where: { name: 'Sueldos' } })) ??
          (await tx.expenseCategory.create({
            data: { name: 'Sueldos', description: 'Sueldos de personal y operarios' },
          }));

        const financialTx = await tx.transaction.create({
          data: {
            userId,
            billingType: BillingType.INTERNAL,
            type: TransactionType.OUTCOME,
            paymentMethod: method,
            amount: netAmount,
            description: `Pago Sueldo ${month}/${year}: ${employee.lastName}, ${employee.firstName}`,
            cashDrawerId: parsedDrawerId,
            bankAccountId: parsedBankId,
            verified: true,
          },
        });
        transactionId = financialTx.id;

        if (parsedBankId) {
          await tx.bankAccount.update({
            where: { id: parsedBankId },
            data: { balance: { decrement: netAmount } },
          });
        }

        await tx.expense.create({
          data: {
            amount: netAmount,
            description: `Sueldo ${month}/${year}: ${employee.lastName}, ${employee.firstName}`,
            categoryId: category.id,
            userId,
            paymentMethod: method,
            cashDrawerId: parsedDrawerId,
            bankAccountId: parsedBankId,
            transactionId: financialTx.id,
          },
        });
      }

      const payroll = await tx.payroll.create({
        data: {
          employeeId: empId,
          periodMonth: month,
          periodYear: year,
          baseSalary: breakdown.base.toNumber(),
          commissions: breakdown.comms.toNumber(),
          overtimeAmount: breakdown.overtime.toNumber(),
          bonuses: breakdown.bonus.toNumber(),
          grossSalary: breakdown.grossSalary.toNumber(),
          advancesDeduction: breakdown.advDeduction.toNumber(),
          otherDeductions: breakdown.otherDeducts.toNumber(),
          netSalary: netAmount,
          status: isPaidNow ? 'PAID' : 'APPROVED',
          paymentDate: isPaidNow ? new Date() : null,
          paymentMethod: method,
          cashDrawerId: parsedDrawerId,
          bankAccountId: parsedBankId,
          transactionId,
          notes: input.notes || null,
        },
      });

      if (breakdown.advDeduction.gt(0)) {
        const pendingAdvances = await tx.salaryAdvance.findMany({
          where: { employeeId: empId, status: 'PENDING' },
          orderBy: { date: 'asc' },
        });
        let remainingToDeduct = breakdown.advDeduction;
        for (const adv of pendingAdvances) {
          if (remainingToDeduct.lte(0)) break;
          await tx.salaryAdvance.update({
            where: { id: adv.id },
            data: { status: 'DEDUCTED', payrollId: payroll.id },
          });
          remainingToDeduct = remainingToDeduct.minus(roundToTwoDecimals(adv.amount));
        }
      }

      return payroll;
    });
  },

  async getPayrolls(filters: { periodMonth?: string; periodYear?: string; employeeId?: string }) {
    const where: Record<string, unknown> = {};
    if (filters.periodMonth) where.periodMonth = Number(filters.periodMonth);
    if (filters.periodYear) where.periodYear = Number(filters.periodYear);
    if (filters.employeeId) where.employeeId = Number(filters.employeeId);

    return prisma.payroll.findMany({
      where,
      include: {
        employee: {
          select: { id: true, firstName: true, lastName: true, dni: true, position: true, cbuAlias: true, bankName: true },
        },
        advances: true,
        transaction: { select: { id: true, receiptNumber: true } },
      },
      orderBy: [{ periodYear: 'desc' }, { periodMonth: 'desc' }],
    });
  },
};
