import { BillingType, PaymentMethod, TransactionType } from '@prisma/client';
import prisma from '../../utils/prisma';
import AppError from '../../utils/AppError';
import { logAudit } from '../../utils/audit';
import { roundToTwoDecimals } from '../../core/money';
import { calculateDrawerClosingBalance } from '../../engines/drawer-arqueo.engine';

export interface IncomingDrawerReceipt {
  clientId: number;
  amount: number;
  billingType?: string;
  paymentMethod?: string;
  checkNumber?: string | null;
  bankAccountId?: number | null;
}

function normalizeReceiptBillingType(raw?: string): BillingType {
  return raw === 'A' || raw === BillingType.OFFICIAL ? BillingType.OFFICIAL : BillingType.INTERNAL;
}

export const cashDrawerService = {
  async openDrawer(params: {
    loggedUserId: number;
    loggedUserRole?: string;
    bodyUserId?: number | null;
    branch?: string;
    drawerType?: string;
    routeNote?: string | null;
    notes?: string | null;
    openingBalance: number;
  }) {
    const targetUserId =
      params.loggedUserRole === 'ADMIN' && params.bodyUserId
        ? Number(params.bodyUserId)
        : params.loggedUserId;
    const drawerBranch = params.branch || 'CONSOLIDADA';
    const openingAmt = roundToTwoDecimals(params.openingBalance).toNumber();

    if (openingAmt < 0) {
      throw new AppError('El saldo inicial debe ser mayor o igual a cero.', 400);
    }

    const existing = await prisma.cashDrawer.findFirst({
      where: { userId: targetUserId, branch: drawerBranch, status: 'OPEN' },
    });

    if (existing) {
      throw new AppError(
        `La caja para el usuario y rama ${drawerBranch} ya se encuentra abierta.`,
        400,
      );
    }

    const drawer = await prisma.cashDrawer.create({
      data: {
        userId: targetUserId,
        branch: drawerBranch,
        drawerType: params.drawerType || 'DEPOSITO',
        routeNote: params.routeNote ? String(params.routeNote).trim() : null,
        notes: params.notes ? String(params.notes).trim() : null,
        openingBalance: openingAmt,
        status: 'OPEN',
      },
    });

    await logAudit({
      userId: params.loggedUserId,
      action: 'OPEN_CASH_DRAWER',
      entityType: 'CashDrawer',
      entityId: drawer.id,
      newValues: drawer,
    });

    return drawer;
  },

  async closeDrawer(params: {
    userId: number;
    drawerId: number;
    realBalance: number;
    routeNote?: string | null;
    notes?: string | null;
    receipts?: IncomingDrawerReceipt[];
  }) {
    const realAmt = roundToTwoDecimals(params.realBalance).toNumber();
    if (realAmt < 0) {
      throw new AppError('El saldo real contado es obligatorio y no puede ser negativo.', 400);
    }

    const { previousDrawer, closedDrawer } = await prisma.$transaction(async (tx) => {
      const drawer = await tx.cashDrawer.findUnique({ where: { id: Number(params.drawerId) } });
      if (!drawer) throw new AppError('Caja no encontrada.', 404);
      if (drawer.status === 'CLOSED') {
        throw new AppError('Esta caja ya se encuentra cerrada.', 400);
      }

      if (params.receipts && Array.isArray(params.receipts) && params.receipts.length > 0) {
        const defaultBank = await tx.bankAccount.findFirst();

        for (const r of params.receipts) {
          const clientId = Number(r.clientId);
          const client = await tx.persona.findUnique({ where: { id: clientId } });
          if (!client) {
            throw new AppError(`Cliente #${clientId} no encontrado al imputar recibo.`, 404);
          }

          const receiptAmt = roundToTwoDecimals(r.amount).toNumber();
          const method = (r.paymentMethod as PaymentMethod) || PaymentMethod.CASH;
          const billing = normalizeReceiptBillingType(r.billingType);
          const checkSuffix = r.checkNumber ? ` (Cheque N° ${String(r.checkNumber).trim()})` : '';
          const bankAccountId =
            method === PaymentMethod.BANK_TRANSFER
              ? (r.bankAccountId ? Number(r.bankAccountId) : defaultBank?.id ?? null)
              : null;

          const createdTx = await tx.transaction.create({
            data: {
              personaId: clientId,
              userId: params.userId,
              billingType: billing,
              type: TransactionType.INCOME,
              paymentMethod: method,
              amount: receiptAmt,
              description: `Recibo/Cobranza - Arqueo de Caja${checkSuffix}`,
              cashDrawerId: drawer.id,
              bankAccountId,
              verified: true,
            },
          });

          const receiptNumber = `REC-${createdTx.movementId.toString().padStart(5, '0')}`;
          await tx.transaction.update({ where: { id: createdTx.id }, data: { receiptNumber } });

          await tx.persona.update({
            where: { id: clientId },
            data: { outstandingBalance: { decrement: receiptAmt } },
          });

          if (method === PaymentMethod.BANK_TRANSFER && bankAccountId) {
            await tx.bankAccount.update({
              where: { id: bankAccountId },
              data: { balance: { increment: receiptAmt } },
            });
          }
        }
      }

      const transactions = await tx.transaction.findMany({ where: { cashDrawerId: drawer.id } });
      const calculatedClosingBalance = calculateDrawerClosingBalance(
        drawer.openingBalance.toString(),
        transactions.map((t) => ({
          type: t.type,
          paymentMethod: t.paymentMethod,
          amount: t.amount.toString(),
          bankAccountId: t.bankAccountId,
        })),
      );

      const closed = await tx.cashDrawer.update({
        where: { id: drawer.id },
        data: {
          closingBalance: calculatedClosingBalance,
          realBalance: realAmt,
          routeNote:
            params.routeNote !== undefined
              ? params.routeNote
                ? String(params.routeNote).trim()
                : null
              : drawer.routeNote,
          notes:
            params.notes !== undefined
              ? params.notes
                ? String(params.notes).trim()
                : null
              : drawer.notes,
          status: 'CLOSED',
          closedAt: new Date(),
        },
      });

      return { previousDrawer: drawer, closedDrawer: closed };
    });

    await logAudit({
      userId: params.userId,
      action: 'CLOSE_CASH_DRAWER',
      entityType: 'CashDrawer',
      entityId: previousDrawer.id,
      oldValues: previousDrawer,
      newValues: closedDrawer,
    });

    return closedDrawer;
  },

  async getActiveDrawer(userId: number) {
    return prisma.cashDrawer.findFirst({ where: { userId, status: 'OPEN' } });
  },

  async getActiveDrawers(userId: number) {
    return prisma.cashDrawer.findMany({ where: { userId, status: 'OPEN' } });
  },
};
