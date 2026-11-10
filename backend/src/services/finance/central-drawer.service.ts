import { TransactionType } from '@prisma/client';
import prisma from '../../utils/prisma';
import AppError from '../../utils/AppError';
import { logAudit } from '../../utils/audit';
import { roundToTwoDecimals } from '../../core/money';
import {
  calculateCentralDrawerBalance,
  calculateDrawerClosingBalance,
} from '../../engines/drawer-arqueo.engine';

export const centralDrawerService = {
  async closeJointDrawers(params: {
    userId: number;
    realBalanceA?: number | null;
    realBalanceX?: number | null;
  }) {
    const auditPairs = await prisma.$transaction(async (tx) => {
      const activeDrawers = await tx.cashDrawer.findMany({
        where: { userId: params.userId, status: 'OPEN' },
      });

      if (activeDrawers.length === 0) {
        throw new AppError('No se encontraron cajas abiertas para realizar un cierre.', 400);
      }

      const results: Array<{ oldDrawer: any; closedDrawer: any }> = [];
      for (const drawer of activeDrawers) {
        const transactions = await tx.transaction.findMany({ where: { cashDrawerId: drawer.id } });
        const theoretical = calculateDrawerClosingBalance(
          drawer.openingBalance.toString(),
          transactions.map((t) => ({
            type: t.type,
            paymentMethod: t.paymentMethod,
            amount: t.amount.toString(),
            bankAccountId: t.bankAccountId,
          })),
        );

        let realVal = theoretical;
        if (drawer.branch === 'A' && params.realBalanceA !== undefined && params.realBalanceA !== null) {
          realVal = roundToTwoDecimals(params.realBalanceA).toNumber();
        } else if (drawer.branch === 'X' && params.realBalanceX !== undefined && params.realBalanceX !== null) {
          realVal = roundToTwoDecimals(params.realBalanceX).toNumber();
        } else if (drawer.branch === 'CONSOLIDADA') {
          const candidate = params.realBalanceA ?? params.realBalanceX;
          realVal =
            candidate !== undefined && candidate !== null
              ? roundToTwoDecimals(candidate).toNumber()
              : theoretical;
        }

        const closed = await tx.cashDrawer.update({
          where: { id: drawer.id },
          data: {
            closingBalance: theoretical,
            realBalance: realVal,
            status: 'CLOSED',
            closedAt: new Date(),
          },
        });
        results.push({ oldDrawer: drawer, closedDrawer: closed });
      }
      return results;
    });

    for (const pair of auditPairs) {
      await logAudit({
        userId: params.userId,
        action: 'CLOSE_CASH_DRAWER',
        entityType: 'CashDrawer',
        entityId: pair.oldDrawer.id,
        oldValues: pair.oldDrawer,
        newValues: pair.closedDrawer,
      });
    }

    return auditPairs.map((p) => p.closedDrawer);
  },

  async getDrawersHistory() {
    return prisma.cashDrawer.findMany({
      where: { status: 'CLOSED' },
      orderBy: { closedAt: 'desc' },
      take: 50,
      include: {
        user: {
          select: {
            id: true,
            username: true,
            employee: { select: { firstName: true, lastName: true } },
          },
        },
        transactions: {
          select: {
            id: true,
            type: true,
            billingType: true,
            paymentMethod: true,
            amount: true,
            description: true,
            createdAt: true,
            receiptNumber: true,
            orderId: true,
            verified: true,
            persona: { select: { id: true, name: true } },
          },
        },
      },
    });
  },

  async closeCentralDrawer(params: { userId: number; realBalance?: number; notes?: string | null }) {
    const numRealBalance =
      params.realBalance !== undefined ? roundToTwoDecimals(params.realBalance).toNumber() : 0;
    if (numRealBalance < 0) {
      throw new AppError('El saldo declarado no puede ser negativo.', 400);
    }

    const lastCentral = await prisma.cashDrawer.findFirst({
      where: { drawerType: 'CENTRAL', status: 'CLOSED' },
      orderBy: { closedAt: 'desc' },
    });
    const cutoffDate = lastCentral?.closedAt || null;

    const [closedDrawers, overallExpenses] = await Promise.all([
      prisma.cashDrawer.findMany({
        where: {
          status: 'CLOSED',
          drawerType: { not: 'CENTRAL' },
          ...(cutoffDate ? { closedAt: { gt: cutoffDate } } : {}),
        },
      }),
      prisma.transaction.findMany({
        where: {
          type: TransactionType.OUTCOME,
          cashDrawerId: null,
          bankAccountId: null,
          ...(cutoffDate ? { createdAt: { gt: cutoffDate } } : {}),
        },
      }),
    ]);

    const { currentCalculatedBalance } = calculateCentralDrawerBalance({
      lastCentralRealBalance: lastCentral?.realBalance?.toString() ?? 0,
      closedDrawers: closedDrawers.map((d) => ({
        realBalance: d.realBalance?.toString() ?? 0,
        openingBalance: d.openingBalance.toString(),
      })),
      overallExpenses: overallExpenses.map((e) => ({ amount: e.amount.toString() })),
    });

    const now = new Date();
    const centralDrawer = await prisma.cashDrawer.create({
      data: {
        userId: params.userId,
        branch: 'CENTRAL',
        drawerType: 'CENTRAL',
        openingBalance: currentCalculatedBalance,
        closingBalance: currentCalculatedBalance,
        realBalance: numRealBalance,
        status: 'CLOSED',
        openedAt: now,
        closedAt: now,
        notes: params.notes
          ? String(params.notes).trim()
          : `Cierre de Caja Grande. Saldo remanente: $${numRealBalance.toLocaleString('es-AR')}.`,
      },
    });

    await logAudit({
      userId: params.userId,
      action: 'CLOSE_CENTRAL_DRAWER',
      entityType: 'CashDrawer',
      entityId: centralDrawer.id,
      newValues: {
        previousBalance: currentCalculatedBalance,
        realBalanceDeclared: numRealBalance,
      },
    });

    return centralDrawer;
  },
};
