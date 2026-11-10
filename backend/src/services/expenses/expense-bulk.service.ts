import { BillingType, PaymentMethod, TransactionType } from '@prisma/client';
import prisma from '../../utils/prisma';
import { logAudit } from '../../utils/audit';
import { roundToTwoDecimals } from '../../core/money';

export async function createBulkExpensesRecords(params: {
  userId: number;
  expenses: any[];
  targetDate?: string | null;
}) {
  const defaultDate = params.targetDate ? new Date(params.targetDate) : new Date();

  const insertedExpenses = await prisma.$transaction(async (tx) => {
    const results = [];
    for (const item of params.expenses) {
      const rawAmt = Number(item.amount);
      if (isNaN(rawAmt) || rawAmt <= 0 || !item.categoryId || !item.description?.trim()) continue;

      const expAmount = roundToTwoDecimals(rawAmt).toNumber();
      let transactionId: number | undefined;
      const itemDate = item.date ? new Date(item.date) : defaultDate;
      const paymentMethod = (item.paymentMethod as PaymentMethod) || PaymentMethod.CASH;

      if (paymentMethod === PaymentMethod.CASH && item.cashDrawerId) {
        const activeDrawer = await tx.cashDrawer.findUnique({
          where: { id: Number(item.cashDrawerId) },
        });
        if (activeDrawer && activeDrawer.status === 'OPEN') {
          const trans = await tx.transaction.create({
            data: {
              userId: params.userId,
              billingType:
                (item.billingType as BillingType) ||
                (activeDrawer.branch === 'A' ? BillingType.OFFICIAL : BillingType.INTERNAL),
              type: TransactionType.OUTCOME,
              paymentMethod: PaymentMethod.CASH,
              amount: expAmount,
              description: `Gasto (Clonado): ${item.description.trim()}`,
              cashDrawerId: activeDrawer.id,
              verified: true,
            },
          });
          transactionId = trans.id;
        }
      } else if (paymentMethod === PaymentMethod.BANK_TRANSFER && item.bankAccountId) {
        const bankAcc = await tx.bankAccount.findUnique({
          where: { id: Number(item.bankAccountId) },
        });
        if (bankAcc) {
          await tx.bankAccount.update({
            where: { id: bankAcc.id },
            data: { balance: { decrement: expAmount } },
          });
          const trans = await tx.transaction.create({
            data: {
              userId: params.userId,
              billingType: (item.billingType as BillingType) || BillingType.INTERNAL,
              type: TransactionType.OUTCOME,
              paymentMethod: PaymentMethod.BANK_TRANSFER,
              amount: expAmount,
              description: `Gasto (Clonado): ${item.description.trim()}`,
              bankAccountId: bankAcc.id,
              verified: true,
            },
          });
          transactionId = trans.id;
        }
      }

      const exp = await tx.expense.create({
        data: {
          amount: expAmount,
          date: itemDate,
          description: item.description.trim(),
          categoryId: Number(item.categoryId),
          userId: params.userId,
          paymentMethod,
          cashDrawerId: item.cashDrawerId ? Number(item.cashDrawerId) : undefined,
          bankAccountId: item.bankAccountId ? Number(item.bankAccountId) : undefined,
          vehicleId: item.vehicleId ? Number(item.vehicleId) : undefined,
          transactionId,
        },
        include: { category: true },
      });
      results.push(exp);
    }
    return results;
  });

  await logAudit({
    userId: params.userId,
    action: 'BULK_CREATE_EXPENSES',
    entityType: 'Expense',
    entityId: 0,
    newValues: { count: insertedExpenses.length, targetDate: params.targetDate },
  });

  return insertedExpenses;
}
