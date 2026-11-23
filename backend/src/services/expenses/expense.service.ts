import { BillingType, PaymentMethod, TransactionType } from '@prisma/client';
import prisma from '../../utils/prisma';
import AppError from '../../utils/AppError';
import { logAudit } from '../../utils/audit';
import { roundToIntegerPeso, roundToTwoDecimals, toDecimal } from '../../core/money';

export const DEFAULT_EXPENSE_CATEGORIES = [
  { name: 'Sueldos', description: 'Sueldos de personal y operarios' },
  { name: 'Servicios', description: 'Servicios públicos (Luz, Gas, Internet, Teléfono, Flow, Claro)' },
  { name: 'Cargas Patronales', description: 'Cargas sociales e impositivas sobre sueldos' },
  { name: 'Impuestos y Patentes', description: 'Tasas municipales, ARBA, Patentes, IVA, Ganancias, Bienes Personales' },
  { name: 'Combustible', description: 'Gasto de combustible para reparto y preventa' },
  { name: 'Seguros', description: 'Seguros de vehículos, incendios y vida' },
  { name: 'Mantenimiento', description: 'Reparaciones y mantenimiento general' },
  { name: 'Gastos Profesionales', description: 'Honorarios del contador, licencias de software (Iduo), etc.' },
  { name: 'Publicidad y Comunicación', description: 'Pauta en Facebook, Radio, etc.' },
  { name: 'Gastos Bancarios', description: 'Comisiones de Mercado Pago, mantenimiento de cuentas bancarias' },
  { name: 'Otros Gastos', description: 'Papelería, artículos de limpieza, gastos varios menores' },
];

export const expenseService = {
  async getCategories() {
    let categories = await prisma.expenseCategory.findMany({ orderBy: { name: 'asc' } });
    if (categories.length === 0) {
      await prisma.expenseCategory.createMany({ data: DEFAULT_EXPENSE_CATEGORIES });
      categories = await prisma.expenseCategory.findMany({ orderBy: { name: 'asc' } });
    }
    return categories;
  },

  async createCategory(params: { name: string; description?: string | null }) {
    const cleanName = params.name.trim();
    const existing = await prisma.expenseCategory.findUnique({ where: { name: cleanName } });
    if (existing) {
      throw new AppError('La categoría ya existe.', 400);
    }

    return prisma.expenseCategory.create({
      data: {
        name: cleanName,
        description: params.description ? params.description.trim() : null,
      },
    });
  },

  async getExpenses(query: {
    categoryId?: string;
    year?: string;
    month?: string;
    paymentMethod?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const whereClause: Record<string, any> = {};

    if (query.categoryId) whereClause.categoryId = Number(query.categoryId);
    if (query.paymentMethod) whereClause.paymentMethod = query.paymentMethod as PaymentMethod;

    if (query.startDate || query.endDate) {
      whereClause.date = {};
      if (query.startDate) whereClause.date.gte = new Date(String(query.startDate));
      if (query.endDate) whereClause.date.lte = new Date(String(query.endDate));
    } else if (query.year && query.month) {
      const y = Number(query.year);
      const m = Number(query.month);
      whereClause.date = {
        gte: new Date(y, m - 1, 1),
        lte: new Date(y, m, 0, 23, 59, 59, 999),
      };
    }

    return prisma.expense.findMany({
      where: whereClause,
      include: {
        category: true,
        user: { select: { id: true, username: true } },
        vehicle: { select: { id: true, plate: true, brand: true, model: true } },
        transaction: true,
      },
      orderBy: { date: 'desc' },
    });
  },

  async createExpense(params: {
    userId: number;
    amount: number;
    categoryId: number;
    description: string;
    date?: string | null;
    paymentMethod: PaymentMethod;
    affectFinance?: boolean;
    cashSource?: 'CAJA_GRANDE' | 'CAJA_OFICINA' | null;
    cashDrawerId?: number | null;
    bankAccountId?: number | null;
    vehicleId?: number | null;
    billingType?: string | null;
  }) {
    const expAmount = roundToIntegerPeso(params.amount).toNumber();
    if (expAmount <= 0) {
      throw new AppError('El monto debe ser un número mayor a cero.', 400);
    }

    const expenseDate = params.date ? new Date(params.date) : new Date();
    const shouldAffectFinance = params.affectFinance !== false;

    return prisma.$transaction(async (tx) => {
      let transactionId: number | undefined;
      let resolvedCashDrawerId: number | undefined;
      let resolvedBankAccountId: number | undefined;

      if (shouldAffectFinance && params.paymentMethod === PaymentMethod.CASH) {
        if (params.cashSource === 'CAJA_GRANDE') {
          const trans = await tx.transaction.create({
            data: {
              userId: params.userId,
              billingType: (params.billingType as BillingType) || BillingType.INTERNAL,
              type: TransactionType.OUTCOME,
              paymentMethod: PaymentMethod.CASH,
              amount: expAmount,
              description: `Gasto: ${params.description.trim()}`,
              cashDrawerId: null,
              verified: true,
            },
          });
          transactionId = trans.id;
        } else {
          let activeDrawer: any = null;

          if (params.cashSource === 'CAJA_OFICINA') {
            activeDrawer = await tx.cashDrawer.findFirst({
              where: {
                status: 'OPEN',
                OR: [{ branch: 'DEPOSITO' }, { drawerType: 'DEPOSITO' }],
              },
              orderBy: { openedAt: 'desc' },
            });
            if (!activeDrawer) {
              throw new AppError(
                'No hay una Caja Oficina abierta. Abrí Caja Oficina para registrar gastos desde ella.',
                400,
              );
            }
          } else {
            let activeDrawerId = params.cashDrawerId ? Number(params.cashDrawerId) : null;
            if (!activeDrawerId) {
              const userDrawer = await tx.cashDrawer.findFirst({
                where: { userId: params.userId, status: 'OPEN' },
              });
              if (!userDrawer) {
                throw new AppError('Debe abrir una caja antes de registrar un gasto en efectivo.', 400);
              }
              activeDrawerId = userDrawer.id;
            }

            activeDrawer = await tx.cashDrawer.findUnique({ where: { id: activeDrawerId } });
            if (!activeDrawer || activeDrawer.status === 'CLOSED') {
              throw new AppError('La caja seleccionada no está abierta.', 400);
            }
          }

          resolvedCashDrawerId = activeDrawer.id;
          const trans = await tx.transaction.create({
            data: {
              userId: params.userId,
              billingType:
                (params.billingType as BillingType) ||
                (activeDrawer.branch === 'A' ? BillingType.OFFICIAL : BillingType.INTERNAL),
              type: TransactionType.OUTCOME,
              paymentMethod: PaymentMethod.CASH,
              amount: expAmount,
              description: `Gasto: ${params.description.trim()}`,
              cashDrawerId: activeDrawer.id,
              verified: true,
            },
          });
          transactionId = trans.id;
        }
      } else if (shouldAffectFinance && params.paymentMethod === PaymentMethod.BANK_TRANSFER) {
        if (!params.bankAccountId) {
          throw new AppError('Debe seleccionar una cuenta bancaria para pagos por transferencia.', 400);
        }

        const bankAcc = await tx.bankAccount.findUnique({
          where: { id: Number(params.bankAccountId) },
        });
        if (!bankAcc) {
          throw new AppError('Cuenta bancaria no encontrada.', 404);
        }

        resolvedBankAccountId = bankAcc.id;
        await tx.bankAccount.update({
          where: { id: bankAcc.id },
          data: { balance: { decrement: expAmount } },
        });

        const trans = await tx.transaction.create({
          data: {
            userId: params.userId,
            billingType: (params.billingType as BillingType) || BillingType.INTERNAL,
            type: TransactionType.OUTCOME,
            paymentMethod: PaymentMethod.BANK_TRANSFER,
            amount: expAmount,
            description: `Gasto: ${params.description.trim()}`,
            bankAccountId: bankAcc.id,
            verified: true,
          },
        });
        transactionId = trans.id;
      }

      return tx.expense.create({
        data: {
          amount: expAmount,
          date: expenseDate,
          description: params.description.trim(),
          categoryId: Number(params.categoryId),
          userId: params.userId,
          paymentMethod: params.paymentMethod,
          cashDrawerId: resolvedCashDrawerId,
          bankAccountId: resolvedBankAccountId,
          vehicleId: params.vehicleId ? Number(params.vehicleId) : undefined,
          transactionId,
        },
        include: { category: true },
      });
    });
  },

  async deleteExpense(params: { userId: number; expenseId: number }) {
    if (isNaN(params.expenseId)) {
      throw new AppError('ID inválido.', 400);
    }

    const expense = await prisma.expense.findUnique({
      where: { id: params.expenseId },
      include: { transaction: true },
    });

    if (!expense) {
      throw new AppError('Gasto no encontrado.', 404);
    }

    await prisma.$transaction(async (tx) => {
      if (expense.transactionId && expense.transaction) {
        const trans = expense.transaction;
        if (trans.bankAccountId) {
          const restoreAmt = roundToTwoDecimals(trans.amount.toString()).toNumber();
          await tx.bankAccount.update({
            where: { id: trans.bankAccountId },
            data: { balance: { increment: restoreAmt } },
          });
        }
        await tx.transaction.delete({ where: { id: trans.id } });
      }
      await tx.expense.delete({ where: { id: expense.id } });
    });

    await logAudit({
      userId: params.userId,
      action: 'DELETE_EXPENSE',
      entityType: 'Expense',
      entityId: params.expenseId,
      oldValues: expense,
    });
  },

  async getExpensePeriods() {
    const rows = await prisma.expense.findMany({
      select: { date: true, amount: true },
      orderBy: { date: 'desc' },
    });

    const map = new Map<string, { year: number; month: number; count: number; total: ReturnType<typeof toDecimal> }>();
    for (const row of rows) {
      const d = new Date(row.date);
      const year = d.getFullYear();
      const month = d.getMonth() + 1;
      const key = `${year}-${month}`;
      const existing = map.get(key);
      const amt = roundToIntegerPeso(row.amount.toString());
      if (existing) {
        existing.count += 1;
        existing.total = existing.total.plus(amt);
      } else {
        map.set(key, { year, month, count: 1, total: amt });
      }
    }

    return Array.from(map.values())
      .map((p) => ({ year: p.year, month: p.month, count: p.count, total: p.total.toNumber() }))
      .sort((a, b) => (b.year !== a.year ? b.year - a.year : b.month - a.month));
  },

  async updateExpense(params: {
    userId: number;
    expenseId: number;
    amount?: number;
    description?: string;
    categoryId?: number;
    date?: string | null;
  }) {
    if (isNaN(params.expenseId)) {
      throw new AppError('ID inválido.', 400);
    }

    const existing = await prisma.expense.findUnique({
      where: { id: params.expenseId },
      include: { transaction: true, category: true },
    });

    if (!existing) {
      throw new AppError('Gasto no encontrado.', 404);
    }

    const nextAmount =
      params.amount !== undefined
        ? roundToIntegerPeso(params.amount)
        : toDecimal(existing.amount.toString());

    if (nextAmount.lte(0)) {
      throw new AppError('El monto debe ser un número mayor a cero.', 400);
    }

    const nextDescription =
      params.description !== undefined ? params.description.trim() : existing.description;
    if (!nextDescription) {
      throw new AppError('La descripción es obligatoria.', 400);
    }

    const nextCategoryId =
      params.categoryId !== undefined ? Number(params.categoryId) : existing.categoryId;
    const nextDate = params.date ? new Date(params.date) : existing.date;

    const oldAmount = toDecimal(existing.amount.toString());
    const delta = nextAmount.minus(oldAmount);

    const updated = await prisma.$transaction(async (tx) => {
      if (existing.transactionId && existing.transaction) {
        const trans = existing.transaction;
        if (trans.bankAccountId && !delta.isZero()) {
          await tx.bankAccount.update({
            where: { id: trans.bankAccountId },
            data: delta.gt(0)
              ? { balance: { decrement: delta.toNumber() } }
              : { balance: { increment: delta.abs().toNumber() } },
          });
        }

        await tx.transaction.update({
          where: { id: trans.id },
          data: {
            amount: nextAmount.toNumber(),
            description: `Gasto: ${nextDescription}`,
          },
        });
      }

      return tx.expense.update({
        where: { id: existing.id },
        data: {
          amount: nextAmount.toNumber(),
          description: nextDescription,
          categoryId: nextCategoryId,
          date: nextDate,
        },
        include: {
          category: true,
          user: { select: { id: true, username: true } },
          vehicle: { select: { id: true, plate: true, brand: true, model: true } },
          transaction: true,
        },
      });
    });

    await logAudit({
      userId: params.userId,
      action: 'UPDATE_EXPENSE',
      entityType: 'Expense',
      entityId: existing.id,
      oldValues: {
        amount: existing.amount.toString(),
        description: existing.description,
        categoryId: existing.categoryId,
        date: existing.date,
      },
      newValues: {
        amount: nextAmount.toNumber(),
        description: nextDescription,
        categoryId: nextCategoryId,
        date: nextDate,
      },
    });

    return updated;
  },
};
