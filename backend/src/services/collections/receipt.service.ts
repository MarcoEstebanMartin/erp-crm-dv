import { LedgerEntryType, LedgerSourceType, Role, TransactionType } from '@prisma/client';
import prisma from '../../utils/prisma';
import AppError from '../../utils/AppError';
import { roundToTwoDecimals } from '../../core/money';
import { recordLedgerMovement } from '../ledger/account-ledger.service';
import { env } from '../../config/env.config';
import { evaluateReceiptVoidPermission } from '../../engines/receipt-void.engine';
import {
  buildPublicReceiptUrl,
  formatVerificationCode,
  generateUniqueVerificationCode,
  signReceiptToken,
  verifyPersistedReceiptCode,
  verifyReceiptToken,
} from '../../core/receiptToken';

const INTERNAL_RECEIPT_DESCRIPTION_PATTERN =
  /rendici[oó]n|chofer\s*:|ruta\s*#|reparto|vendedor\s*:|pago\s+de\s+|emisor\s*:|cierre\s+de|caja\s+|arqueo|backfill|migraci[oó]n|interno|auditor|cobro\s+digital|recibo\s+digital|en\s+calle/i;

export function sanitizePublicReceiptDescription(rawDescription?: string | null): string {
  const trimmed = (rawDescription || '').trim().replace(/\s+/g, ' ');
  if (!trimmed) return 'Pago a cuenta corriente';

  const invoiceMatch = trimmed.match(/factura\s+([A-Z]?\s*\d{4}-\d{8})/i);
  if (invoiceMatch) {
    return `Pago Factura ${invoiceMatch[1].replace(/\s+/g, ' ').trim()}`;
  }

  const checkMatch = trimmed.match(/cheque\s*n[°º]?\s*([A-Z0-9-]+)/i);
  if (checkMatch && checkMatch[1].toUpperCase() !== 'S/N') {
    return `Pago a cuenta corriente · Cheque N° ${checkMatch[1]}`;
  }

  if (INTERNAL_RECEIPT_DESCRIPTION_PATTERN.test(trimmed)) {
    return 'Pago a cuenta corriente';
  }

  return trimmed.length > 60 ? `${trimmed.slice(0, 57).trimEnd()}…` : trimmed;
}

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
        fieldReceipt: { is: null },
        OR: [
          { receiptNumber: null },
          { NOT: { receiptNumber: { startsWith: 'REC-C-' } } },
        ],
      },
      include: {
        persona: {
          select: {
            id: true,
            name: true,
            phone: true,
            whatsappVerifiedAt: true,
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
        cashDrawer: {
          select: {
            id: true,
            status: true,
          },
        },
        voidedBy: {
          select: {
            id: true,
            username: true,
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
        voidedBy: {
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

    const { user: internalUser, voidedBy: internalVoidedBy, voidReason: internalVoidReason, ...safeTransaction } = transaction;
    const isVoided = Boolean(transaction.voidedAt);

    return {
      ...safeTransaction,
      isVoided,
      ...(options?.isAuthenticatedStaff
        ? { user: internalUser, voidedBy: internalVoidedBy, voidReason: internalVoidReason }
        : {
            description: sanitizePublicReceiptDescription(transaction.description),
            user: undefined,
            voidedBy: undefined,
            voidReason: undefined,
          }),
      ...buildOfficeReceiptSecurityMeta(transaction.id, transaction.verificationCode),
      authenticity: {
        verified: !isVoided,
        status: isVoided ? 'VOIDED' : 'VALID',
        issuer: 'Distribuidora Don Venancio',
      },
    };
  },

  /**
   * Anula un recibo de oficina sin borrado físico (soft-void auditable).
   * - Exige motivo obligatorio (mín. 5 caracteres).
   * - Opción 1 (Híbrida): FACTURACION solo puede anular recibos del mismo día (AR),
   *   no verificados y cuya caja no esté cerrada. ADMIN puede anular cualquier recibo de oficina.
   * - Inserta reversión en AccountLedger vinculada al mismo `transactionId`, limpia `PaymentAllocation`
   *   y registra rastro completo en `Transaction` + `AuditLog`.
   */
  async voidReceipt(params: {
    adminId: number;
    userRole: Role;
    receiptId: number;
    reason: string;
    now?: Date;
  }) {
    if (isNaN(params.receiptId) || params.receiptId <= 0) {
      throw new AppError('ID de recibo inválido', 400);
    }

    const cleanReason = String(params.reason || '').trim();
    if (cleanReason.length < 5) {
      throw new AppError('Ingresá un motivo de anulación de al menos 5 caracteres.', 400);
    }

    const preCheck = await prisma.transaction.findUnique({
      where: { id: params.receiptId },
      include: {
        persona: { select: { id: true, name: true } },
        fieldReceipt: { select: { id: true, receiptNumber: true } },
        cashDrawer: { select: { id: true, status: true } },
      },
    });

    if (!preCheck || preCheck.type !== TransactionType.INCOME) {
      throw new AppError('Recibo no encontrado', 404);
    }

    const preEval = evaluateReceiptVoidPermission({
      userRole: params.userRole,
      createdAt: preCheck.createdAt,
      now: params.now,
      verified: Boolean(preCheck.verified),
      alreadyVoided: Boolean(preCheck.voidedAt),
      isFieldReceipt: Boolean(preCheck.fieldReceipt),
      fieldReceiptLabel: preCheck.fieldReceipt
        ? preCheck.fieldReceipt.receiptNumber || `#${preCheck.fieldReceipt.id}`
        : null,
      cashDrawerStatus: preCheck.cashDrawer?.status ?? null,
    });

    if (!preEval.allowed) {
      throw new AppError(preEval.reason || 'No permitido anular este recibo.', preEval.statusCode || 403);
    }

    const voidedAt = params.now ?? new Date();
    const amountToRestore = roundToTwoDecimals(preCheck.amount.toString()).toNumber();

    await prisma.$transaction(async (prismaTx) => {
      if (typeof (prismaTx as any).$queryRaw === 'function') {
        await (prismaTx as any).$queryRaw`SELECT id FROM "Transaction" WHERE id = ${preCheck.id} FOR UPDATE`;
      }

      const txRecord =
        typeof (prismaTx as any).transaction?.findUnique === 'function'
          ? await prismaTx.transaction.findUnique({
              where: { id: preCheck.id },
              include: {
                persona: { select: { id: true, name: true } },
                fieldReceipt: { select: { id: true, receiptNumber: true } },
                cashDrawer: { select: { id: true, status: true } },
              },
            })
          : preCheck;

      if (!txRecord || txRecord.type !== TransactionType.INCOME) {
        throw new AppError('Recibo no encontrado', 404);
      }

      const lockedEval = evaluateReceiptVoidPermission({
        userRole: params.userRole,
        createdAt: txRecord.createdAt,
        now: voidedAt,
        verified: Boolean(txRecord.verified),
        alreadyVoided: Boolean(txRecord.voidedAt),
        isFieldReceipt: Boolean(txRecord.fieldReceipt),
        fieldReceiptLabel: txRecord.fieldReceipt
          ? txRecord.fieldReceipt.receiptNumber || `#${txRecord.fieldReceipt.id}`
          : null,
        cashDrawerStatus: txRecord.cashDrawer?.status ?? null,
      });

      if (!lockedEval.allowed) {
        throw new AppError(
          lockedEval.reason || 'No permitido anular este recibo.',
          lockedEval.statusCode || 403,
        );
      }

      if (txRecord.personaId) {
        await recordLedgerMovement(prismaTx, {
          personaId: txRecord.personaId,
          entryType: LedgerEntryType.DEBIT,
          sourceType: LedgerSourceType.RECEIPT_REVERSAL,
          billingType: txRecord.billingType,
          amount: amountToRestore,
          orderId: txRecord.orderId,
          transactionId: txRecord.id,
          userId: params.adminId,
          reference: `Anulación Recibo #${txRecord.id}`,
          description: `Reversión por anulación de Recibo N° ${txRecord.receiptNumber || 'INT-' + txRecord.id.toString().padStart(5, '0')} (${cleanReason})`,
        });
      }

      if (typeof (prismaTx as any).paymentAllocation?.deleteMany === 'function') {
        await prismaTx.paymentAllocation.deleteMany({
          where: { transactionId: txRecord.id },
        });
      }

      if (txRecord.verified && txRecord.bankAccountId) {
        await prismaTx.bankAccount.update({
          where: { id: txRecord.bankAccountId },
          data: { balance: { decrement: amountToRestore } },
        });
      }

      await prismaTx.transaction.update({
        where: { id: txRecord.id },
        data: {
          voidedAt,
          voidedById: params.adminId,
          voidReason: cleanReason,
        },
      });

      await prismaTx.auditLog.create({
        data: {
          userId: params.adminId,
          action: 'VOID_COLLECTION_RECEIPT',
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
            cashDrawerId: txRecord.cashDrawerId,
          },
          newValues: {
            voidedAt: voidedAt.toISOString(),
            voidedById: params.adminId,
            voidReason: cleanReason,
          },
        },
      });
    });

    return {
      receiptLabel: preCheck.receiptNumber || `N° ${preCheck.id}`,
      amountToRestore,
      voidedAt,
      voidReason: cleanReason,
    };
  },

  /** Alias retrocompatible que delega a `voidReceipt` (nunca elimina físicamente). */
  async deleteReceipt(params: {
    adminId: number;
    userRole: Role;
    receiptId: number;
    reason?: string;
    now?: Date;
  }) {
    return this.voidReceipt({
      adminId: params.adminId,
      userRole: params.userRole,
      receiptId: params.receiptId,
      reason: params.reason || '',
      now: params.now,
    });
  },
};
