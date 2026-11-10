import { BillingType, PaymentMethod, TransactionType } from '@prisma/client';
import prisma from '../../utils/prisma';
import AppError from '../../utils/AppError';
import { roundToTwoDecimals, toDecimal } from '../../core/money';
import { calculateRendicionSummary } from '../../engines/drawer-arqueo.engine';

interface RendicionBucket {
  totalToCollectDec: ReturnType<typeof toDecimal>;
  totalBranchADec: ReturnType<typeof toDecimal>;
  totalBranchXDec: ReturnType<typeof toDecimal>;
  totalCashDec: ReturnType<typeof toDecimal>;
  totalChecksDec: ReturnType<typeof toDecimal>;
  totalTransfersDec: ReturnType<typeof toDecimal>;
  transactions: any[];
  meta: Record<string, any>;
}

function createEmptyBucket(meta: Record<string, any>): RendicionBucket {
  return {
    totalToCollectDec: toDecimal(0),
    totalBranchADec: toDecimal(0),
    totalBranchXDec: toDecimal(0),
    totalCashDec: toDecimal(0),
    totalChecksDec: toDecimal(0),
    totalTransfersDec: toDecimal(0),
    transactions: [],
    meta,
  };
}

function serializeBucket(bucket: RendicionBucket) {
  return {
    ...bucket.meta,
    totalToCollect: roundToTwoDecimals(bucket.totalToCollectDec).toNumber(),
    totalBranchA: roundToTwoDecimals(bucket.totalBranchADec).toNumber(),
    totalBranchX: roundToTwoDecimals(bucket.totalBranchXDec).toNumber(),
    totalCash: roundToTwoDecimals(bucket.totalCashDec).toNumber(),
    totalChecks: roundToTwoDecimals(bucket.totalChecksDec).toNumber(),
    totalTransfers: roundToTwoDecimals(bucket.totalTransfersDec).toNumber(),
    transactions: bucket.transactions,
  };
}

export const rendicionService = {
  async getPendingRendiciones() {
    const pendingTransactions = await prisma.transaction.findMany({
      where: { type: TransactionType.INCOME, verified: false },
      include: {
        user: { select: { id: true, username: true, role: true } },
        persona: {
          select: {
            id: true,
            name: true,
            city: true,
            route: true,
            saleRoute: { select: { id: true, name: true } },
          },
        },
        order: { include: { deliveryRoute: true } },
      },
    });

    const sellersGroup: Record<number, RendicionBucket> = {};
    const routesGroup: Record<number, RendicionBucket> = {};

    for (const tx of pendingTransactions) {
      const route = tx.order?.deliveryRoute;
      const amtDec = roundToTwoDecimals(tx.amount.toString());
      const isOfficial = tx.billingType === BillingType.OFFICIAL;
      const method = tx.paymentMethod;

      const bucket = route
        ? (routesGroup[route.id] ??= createEmptyBucket({
            routeId: route.id,
            driverName: route.driverName,
            vehiclePlate: route.vehiclePlate,
          }))
        : (sellersGroup[tx.userId] ??= createEmptyBucket({
            user: tx.user,
          }));

      bucket.totalToCollectDec = bucket.totalToCollectDec.plus(amtDec);
      if (isOfficial) bucket.totalBranchADec = bucket.totalBranchADec.plus(amtDec);
      else bucket.totalBranchXDec = bucket.totalBranchXDec.plus(amtDec);

      if (method === PaymentMethod.CASH) bucket.totalCashDec = bucket.totalCashDec.plus(amtDec);
      else if (method === PaymentMethod.CHECK) bucket.totalChecksDec = bucket.totalChecksDec.plus(amtDec);
      else if (method === PaymentMethod.BANK_TRANSFER) bucket.totalTransfersDec = bucket.totalTransfersDec.plus(amtDec);

      bucket.transactions.push(tx);
    }

    return {
      sellers: Object.values(sellersGroup).map(serializeBucket),
      routes: Object.values(routesGroup).map(serializeBucket),
    };
  },

  async verifyRendicion(params: {
    adminId: number;
    sellerId?: number | null;
    routeId?: number | null;
    realCash?: number;
    realChecks?: number;
    destinationDrawerId?: number | null;
    routeNote?: string | null;
    notes?: string | null;
    declaredChecks?: any[];
    hostOrigin: string;
  }) {
    if (!params.sellerId && !params.routeId) {
      throw new AppError('Debe especificar sellerId o routeId', 400);
    }

    const inputCash = roundToTwoDecimals(params.realCash ?? 0).toNumber();
    const inputChecks = roundToTwoDecimals(params.realChecks ?? 0).toNumber();
    if (inputCash < 0 || inputChecks < 0) {
      throw new AppError('Montos reales ingresados inválidos', 400);
    }

    let txs: any[] = [];
    let branchName = '';
    const drawerType = params.sellerId ? 'VENDEDOR' : 'REPARTIDOR';

    if (params.sellerId) {
      const sellerUser = await prisma.user.findUnique({ where: { id: Number(params.sellerId) } });
      if (!sellerUser) {
        throw new AppError('Vendedor no encontrado', 404);
      }
      branchName = `VENDEDOR: ${sellerUser.username.toUpperCase()}`;

      const allSellerTxs = await prisma.transaction.findMany({
        where: { userId: Number(params.sellerId), type: TransactionType.INCOME, verified: false },
        include: {
          order: true,
          persona: { select: { id: true, name: true, phone: true } },
        },
      });
      txs = allSellerTxs.filter((t) => !t.order || t.order.deliveryRouteId === null);
    } else if (params.routeId) {
      const route = await prisma.deliveryRoute.findUnique({ where: { id: Number(params.routeId) } });
      if (!route) {
        throw new AppError('Hoja de ruta no encontrada', 404);
      }
      branchName = `REPARTIDOR: ${route.driverName} (Ruta #${params.routeId})`;

      txs = await prisma.transaction.findMany({
        where: {
          type: TransactionType.INCOME,
          verified: false,
          order: { deliveryRouteId: Number(params.routeId) },
        },
        include: { persona: { select: { id: true, name: true, phone: true } } },
      });
    }

    if (txs.length === 0) {
      throw new AppError('No hay transacciones pendientes para verificar', 400);
    }

    const summary = calculateRendicionSummary({
      transactions: txs.map((t) => ({ paymentMethod: t.paymentMethod, amount: t.amount.toString() })),
      realCash: inputCash,
      realChecks: inputChecks,
    });

    let extraNotes = params.notes ? String(params.notes).trim() : '';
    if (params.declaredChecks && Array.isArray(params.declaredChecks) && params.declaredChecks.length > 0) {
      const checksFormatted = params.declaredChecks
        .map((c: any) => `N° ${c.number || 'S/N'} (${c.bank || 'Banco'}) $${c.amount}`)
        .join('; ');
      extraNotes += (extraNotes ? ' | ' : '') + `Cheques: ${checksFormatted}`;
    }

    const minCreatedAt = txs.reduce(
      (min: Date, t: any) => (t.createdAt < min ? t.createdAt : min),
      txs[0].createdAt,
    );

    const drawer = await prisma.$transaction(async (tx) => {
      const createdDrawer = await tx.cashDrawer.create({
        data: {
          userId: params.adminId,
          branch: branchName,
          drawerType,
          routeNote: params.routeNote ? String(params.routeNote).trim() : null,
          notes: extraNotes || null,
          openingBalance: 0,
          closingBalance: summary.theoreticalClosing,
          realBalance: summary.realTotal,
          status: 'CLOSED',
          openedAt: minCreatedAt,
          closedAt: new Date(),
        },
      });

      const defaultBank = await tx.bankAccount.findFirst();
      const targetDrawerId = params.destinationDrawerId ? Number(params.destinationDrawerId) : null;

      if (targetDrawerId && summary.realCash > 0) {
        await tx.transaction.create({
          data: {
            userId: params.adminId,
            cashDrawerId: targetDrawerId,
            billingType: BillingType.INTERNAL,
            type: TransactionType.INCOME,
            paymentMethod: PaymentMethod.CASH,
            amount: summary.realCash,
            description: `Ingreso Rendición de Fondos - ${branchName}`,
            verified: true,
          },
        });
      }

      for (const t of txs) {
        if (t.paymentMethod === PaymentMethod.BANK_TRANSFER || t.paymentMethod === PaymentMethod.CHECK) {
          const selectedBankId = t.bankAccountId || defaultBank?.id || null;
          const txAmt = roundToTwoDecimals(t.amount.toString()).toNumber();

          await tx.transaction.update({
            where: { id: t.id },
            data: { verified: true, cashDrawerId: createdDrawer.id, bankAccountId: selectedBankId },
          });

          if (selectedBankId) {
            await tx.bankAccount.update({
              where: { id: selectedBankId },
              data: { balance: { increment: txAmt } },
            });
          }
        } else {
          await tx.transaction.update({
            where: { id: t.id },
            data: { verified: true, cashDrawerId: createdDrawer.id },
          });
        }
      }

      await tx.auditLog.create({
        data: {
          userId: params.adminId,
          action: 'CLOSE_OPERATIVE_DRAWER_RENDICION',
          entityType: 'CashDrawer',
          entityId: createdDrawer.id,
          newValues: {
            branch: branchName,
            expectedCash: summary.expectedCash,
            expectedChecks: summary.expectedChecks,
            realCash: summary.realCash,
            realChecks: summary.realChecks,
            transactionsCount: txs.length,
          },
        },
      });

      return createdDrawer;
    });

    const verifiedReceipts = txs.map((t) => {
      const formattedReceiptNumber =
        t.receiptNumber || `REC-${t.movementId.toString().padStart(5, '0')}`;
      if (t.persona?.phone) {
        const cleanPhone = t.persona.phone.replace(/\D/g, '');
        console.log(
          `[WhatsApp ERP Auto-Send] Acreditación verificada a ${t.persona.name} (+${cleanPhone}): ${params.hostOrigin}/recibo/${t.id}`,
        );
      }
      return {
        id: t.id,
        receiptNumber: formattedReceiptNumber,
        amount: roundToTwoDecimals(t.amount.toString()).toNumber(),
        paymentMethod: t.paymentMethod,
        clientName: t.persona?.name || 'Cliente Desconocido',
        clientPhone: t.persona?.phone || null,
        billingType: t.billingType,
      };
    });

    return {
      message: 'Rendición y arqueo completados con éxito. Fondos transferidos a la Caja Grande.',
      drawer,
      difference: summary.difference,
      verifiedReceipts,
    };
  },
};
