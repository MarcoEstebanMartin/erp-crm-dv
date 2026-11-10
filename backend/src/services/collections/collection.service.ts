import {
  BillingType,
  LedgerEntryType,
  LedgerSourceType,
  PaymentMethod,
  Role,
  TransactionType,
} from '@prisma/client';
import prisma from '../../utils/prisma';
import AppError from '../../utils/AppError';
import { personaService } from '../persona.service';
import { roundToTwoDecimals, toDecimal } from '../../core/money';
import { recordLedgerMovement } from '../ledger/account-ledger.service';

export const collectionService = {
  async getPendingCollections(userId: number, userRole?: Role) {
    const whereClause: Record<string, any> = {
      outstandingBalance: { gt: 0 },
      isActive: true,
    };

    if (userRole === Role.VENDEDOR) {
      whereClause.sellerId = userId;
    }

    return prisma.persona.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        address: true,
        city: true,
        outstandingBalance: true,
        phone: true,
      },
    });
  },

  async getCollectionsSummary() {
    const [outstandingAggregate, pendingTransactions] = await Promise.all([
      prisma.persona.aggregate({
        where: { isClient: true, isActive: true, outstandingBalance: { gt: 0 } },
        _sum: { outstandingBalance: true },
        _count: { id: true },
      }),
      prisma.transaction.findMany({
        where: { type: TransactionType.INCOME, verified: false },
        select: {
          amount: true,
          userId: true,
          order: { select: { deliveryRouteId: true } },
        },
      }),
    ]);

    const totalOutstandingBalance = roundToTwoDecimals(
      outstandingAggregate._sum.outstandingBalance?.toString() ?? 0,
    ).toNumber();
    const pendingClientsCount = outstandingAggregate._count.id || 0;

    let pendingAmountDec = toDecimal(0);
    const sellersSet = new Set<number>();
    const driversSet = new Set<number>();

    for (const tx of pendingTransactions) {
      pendingAmountDec = pendingAmountDec.plus(roundToTwoDecimals(tx.amount?.toString() ?? 0));
      if (tx.order?.deliveryRouteId) {
        driversSet.add(tx.order.deliveryRouteId);
      } else if (tx.userId) {
        sellersSet.add(tx.userId);
      }
    }

    const pendingSellersCount = sellersSet.size;
    const pendingDriversCount = driversSet.size;

    return {
      totalOutstandingBalance,
      pendingClientsCount,
      pendingRendicionesAmount: roundToTwoDecimals(pendingAmountDec).toNumber(),
      pendingRendicionesCount: pendingSellersCount + pendingDriversCount,
      pendingSellersCount,
      pendingDriversCount,
    };
  },

  async registerCollection(params: {
    userId: number;
    userRole?: Role;
    personaId: number;
    amount: number;
    paymentMethod: PaymentMethod;
    billingType: BillingType;
    description?: string | null;
    orderId?: number | null;
    isCreditOnAccount?: boolean;
    bankAccountId?: number | null;
    checkNumber?: string | null;
    hostOrigin: string;
  }) {
    if (!params.orderId && !params.isCreditOnAccount) {
      const pendingInvoices = await personaService.getPersonaPendingInvoices(
        Number(params.personaId),
        params.userId,
        params.userRole || '',
      );
      if (pendingInvoices && pendingInvoices.length > 0) {
        throw new AppError(
          'El cliente posee facturas pendientes. Selecciona una factura a la cual imputar el pago o marca la casilla "Dejar dinero a favor".',
          400,
        );
      }
    }

    const client = await prisma.persona.findUnique({ where: { id: Number(params.personaId) } });
    if (!client) throw new AppError('Cliente no encontrado', 404);

    if (params.userRole === Role.VENDEDOR && client.isClient && client.sellerId !== params.userId) {
      throw new AppError(
        'Acceso denegado. No podés registrar cobros para clientes de otros vendedores.',
        403,
      );
    }

    const roundedAmount = roundToTwoDecimals(params.amount).toNumber();
    const fifteenSecondsAgo = new Date(Date.now() - 15000);
    const duplicateTx = await prisma.transaction.findFirst({
      where: {
        personaId: client.id,
        amount: roundedAmount,
        paymentMethod: params.paymentMethod,
        type: TransactionType.INCOME,
        createdAt: { gte: fifteenSecondsAgo },
      },
    });
    if (duplicateTx) {
      throw new AppError(
        'Ya se registró un cobro idéntico para este cliente hace instantes.',
        400,
      );
    }

    let orderNumberDesc = '';
    let finalBillingType = params.billingType;
    if (params.orderId) {
      const targetOrder = await prisma.order.findUnique({ where: { id: Number(params.orderId) } });
      if (targetOrder) {
        orderNumberDesc =
          targetOrder.invoiceNumber || `INT-${targetOrder.id.toString().padStart(5, '0')}`;
        finalBillingType = targetOrder.billingType;
      }
    }

    const checkInfoStr = params.checkNumber ? ` (Cheque N° ${params.checkNumber})` : '';

    const transaction = await prisma.$transaction(async (tx) => {
      const newTx = await tx.transaction.create({
        data: {
          userId: params.userId,
          personaId: client.id,
          billingType: finalBillingType,
          type: TransactionType.INCOME,
          paymentMethod: params.paymentMethod,
          amount: roundedAmount,
          description: params.description
            ? `${params.description}${checkInfoStr}`
            : params.orderId
              ? `Cobro Factura ${orderNumberDesc}${checkInfoStr}`
              : `Cobro a cliente ${client.name}${checkInfoStr}`,
          receiptNumber: null,
          verified: false,
          orderId: params.orderId ? Number(params.orderId) : null,
          bankAccountId: params.bankAccountId ? Number(params.bankAccountId) : null,
        },
      });

      const formattedReceiptNumber = `REC-${newTx.movementId.toString().padStart(5, '0')}`;
      await recordLedgerMovement(tx, {
        personaId: client.id,
        entryType: LedgerEntryType.CREDIT,
        sourceType: LedgerSourceType.COLLECTION_RECEIPT,
        billingType: finalBillingType,
        amount: roundedAmount,
        orderId: params.orderId ? Number(params.orderId) : null,
        transactionId: newTx.id,
        userId: params.userId,
        reference: `Recibo #${newTx.id}`,
        description: `Recibo N° ${formattedReceiptNumber}${newTx.description ? ' - ' + newTx.description : ''}`,
      });

      return tx.transaction.update({
        where: { id: newTx.id },
        data: { receiptNumber: formattedReceiptNumber },
        include: {
          persona: {
            select: {
              id: true,
              code: true,
              name: true,
              cuit: true,
              address: true,
              city: true,
              phone: true,
            },
          },
        },
      });
    });

    if (transaction.persona?.phone) {
      const cleanPhone = transaction.persona.phone.replace(/\D/g, '');
      console.log(
        `[WhatsApp ERP Auto-Send] Registro inicial de cobro a ${transaction.persona.name} (+${cleanPhone}): ${params.hostOrigin}/recibo/${transaction.id}`,
      );
    }

    await prisma.auditLog.create({
      data: {
        userId: params.userId,
        action: 'CREATE_COLLECTION',
        entityType: 'Transaction',
        entityId: transaction.id,
        newValues: JSON.parse(JSON.stringify(transaction)),
      },
    });

    return transaction;
  },
};
