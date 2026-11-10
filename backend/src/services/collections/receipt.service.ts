import { Role, TransactionType } from '@prisma/client';
import prisma from '../../utils/prisma';
import AppError from '../../utils/AppError';
import { roundToTwoDecimals } from '../../core/money';

export const receiptService = {
  /**
   * Obtiene un recibo de pago sanitizando campos sensibles (jamás expone passwordHash ni webPin).
   */
  async getReceipt(id: number) {
    if (isNaN(id)) {
      throw new AppError('ID de recibo inválido', 400);
    }

    const transaction = await prisma.transaction.findUnique({
      where: { id },
      include: {
        persona: {
          select: {
            id: true,
            code: true,
            name: true,
            cuit: true,
            address: true,
            city: true,
          },
        },
        user: {
          select: {
            id: true,
            username: true,
          },
        },
      },
    });

    if (!transaction || transaction.type !== TransactionType.INCOME) {
      throw new AppError('Recibo no encontrado', 404);
    }

    return transaction;
  },

  async deleteReceipt(params: { adminId: number; userRole: Role; receiptId: number }) {
    if (isNaN(params.receiptId)) {
      throw new AppError('ID de recibo inválido', 400);
    }

    const txRecord = await prisma.transaction.findUnique({
      where: { id: params.receiptId },
      include: { persona: { select: { id: true, name: true } } },
    });

    if (!txRecord || txRecord.type !== TransactionType.INCOME) {
      throw new AppError('Recibo no encontrado', 404);
    }

    if (txRecord.verified && params.userRole !== Role.ADMIN) {
      throw new AppError(
        'Este recibo ya fue verificado en una rendición. Solo un Administrador puede anularlo para corregir saldos de caja.',
        400,
      );
    }

    const amountToRestore = roundToTwoDecimals(txRecord.amount.toString()).toNumber();

    await prisma.$transaction(async (prismaTx) => {
      if (txRecord.personaId) {
        await prismaTx.persona.update({
          where: { id: txRecord.personaId },
          data: { outstandingBalance: { increment: amountToRestore } },
        });
      }

      if (txRecord.verified && txRecord.bankAccountId) {
        await prismaTx.bankAccount.update({
          where: { id: txRecord.bankAccountId },
          data: { balance: { decrement: amountToRestore } },
        });
      }

      await prismaTx.transaction.delete({ where: { id: txRecord.id } });

      await prismaTx.auditLog.create({
        data: {
          userId: params.adminId,
          action: 'DELETE_COLLECTION_RECEIPT',
          entityType: 'Transaction',
          entityId: txRecord.id,
          oldValues: {
            receiptNumber: txRecord.receiptNumber,
            amount: amountToRestore,
            personaId: txRecord.personaId,
            personaName: txRecord.persona?.name,
            paymentMethod: txRecord.paymentMethod,
            billingType: txRecord.billingType,
            verified: txRecord.verified,
          },
        },
      });
    });

    return {
      receiptLabel: txRecord.receiptNumber || `N° ${txRecord.id}`,
      amountToRestore,
    };
  },
};
