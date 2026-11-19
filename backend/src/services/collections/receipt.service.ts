import { LedgerEntryType, LedgerSourceType, Role, TransactionType } from '@prisma/client';
import prisma from '../../utils/prisma';
import AppError from '../../utils/AppError';
import { roundToTwoDecimals } from '../../core/money';
import { recordLedgerMovement } from '../ledger/account-ledger.service';
import { env } from '../../config/env.config';
import {
  buildPublicReceiptUrl,
  formatVerificationCode,
  generateUniqueVerificationCode,
  signReceiptToken,
  verifyPersistedReceiptCode,
  verifyReceiptToken,
} from '../../core/receiptToken';

export function buildOfficeReceiptSecurityMeta(
  id: number,
  persistedVerificationCode?: string | null,
) {
  const cleanCode = (persistedVerificationCode || '').trim();
  if (cleanCode) {
    return {
      shareToken: cleanCode,
      verificationCode: cleanCode,
      publicUrl: buildPublicReceiptUrl({
        baseUrl: env.PUBLIC_APP_URL,
        id,
        token: cleanCode,
      }),
    };
  }

  const shareToken = signReceiptToken({
    kind: 'office',
    id,
    secret: env.RECEIPT_SIGNING_SECRET,
  });
  return {
    shareToken,
    verificationCode: formatVerificationCode(shareToken),
    publicUrl: buildPublicReceiptUrl({
      baseUrl: env.PUBLIC_APP_URL,
      id,
      token: shareToken,
    }),
  };
}

export const receiptService = {
  /**
   * Lista los recibos de cobro registrados en oficina/mostrador/cuenta corriente.
   */
  async listReceipts(limit = 200) {
    const safeLimit = Math.min(Math.max(Number(limit) || 200, 1), 500);
    const rows = await prisma.transaction.findMany({
      where: {
        type: TransactionType.INCOME,
        personaId: { not: null },
      },
      include: {
        persona: {
          select: {
            id: true,
            name: true,
            phone: true,
          },
        },
        user: {
          select: {
            id: true,
            username: true,
          },
        },
        order: {
          select: {
            id: true,
            invoiceNumber: true,
          },
        },
        bankAccount: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: safeLimit,
    });

    const rowsWithCode = await Promise.all(
      rows.map(async (row) => {
        let verificationCode = row.verificationCode;
        if (!verificationCode) {
          const generated = generateUniqueVerificationCode();
          try {
            const updated = await prisma.transaction.update({
              where: { id: row.id },
              data: { verificationCode: generated },
              select: { verificationCode: true },
            });
            verificationCode = updated.verificationCode || generated;
          } catch {
            verificationCode = generated;
          }
        }
        return {
          ...row,
          ...buildOfficeReceiptSecurityMeta(row.id, verificationCode),
        };
      }),
    );

    return rowsWithCode;
  },

  /**
   * Obtiene un recibo de pago sanitizando campos sensibles (jamás expone passwordHash ni webPin).
   * Para accesos públicos externos valida el código único persistido en BD (`?v=DV-...`),
   * con respaldo retrocompatible para firmas HMAC anteriores (anti-enumeración IDOR).
   */
  async getReceipt(
    id: number,
    options?: { token?: string; isAuthenticatedStaff?: boolean },
  ) {
    if (isNaN(id) || id <= 0) {
      throw new AppError('ID de recibo inválido', 400);
    }

    const transaction = await prisma.transaction.findUnique({
      where: { id },
      include: {
        persona: {
          select: {
            id: true,
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
      if (!options?.isAuthenticatedStaff) {
        throw new AppError('Comprobante no encontrado o enlace de verificación inválido', 404);
      }
      throw new AppError('Recibo no encontrado', 404);
    }

    if (!options?.isAuthenticatedStaff) {
      const matchesPersisted = verifyPersistedReceiptCode(
        transaction.verificationCode,
        options?.token,
      );
      const matchesLegacyHmac =
        !matchesPersisted &&
        verifyReceiptToken({
          kind: 'office',
          id,
          token: options?.token,
          secret: env.RECEIPT_SIGNING_SECRET,
        });
      if (!matchesPersisted && !matchesLegacyHmac) {
        throw new AppError('Comprobante no encontrado o enlace de verificación inválido', 404);
      }
    }

    return {
      ...transaction,
      ...buildOfficeReceiptSecurityMeta(transaction.id, transaction.verificationCode),
      authenticity: {
        verified: true,
        issuer: 'Distribuidora Don Venancio',
      },
    };
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
        await recordLedgerMovement(prismaTx, {
          personaId: txRecord.personaId,
          entryType: LedgerEntryType.DEBIT,
          sourceType: LedgerSourceType.RECEIPT_REVERSAL,
          billingType: txRecord.billingType,
          amount: amountToRestore,
          orderId: txRecord.orderId,
          userId: params.adminId,
          reference: `Anulación Recibo #${txRecord.id}`,
          description: `Reversión por anulación de Recibo N° ${txRecord.receiptNumber || 'INT-' + txRecord.id.toString().padStart(5, '0')}`,
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
