import {
  BillingType,
  CreditNoteStatus,
  LedgerEntryType,
  LedgerSourceType,
} from '@prisma/client';
import prisma from '../../utils/prisma';
import AppError from '../../utils/AppError';
import { logAudit } from '../../utils/audit';
import { emitirNotaCreditoAFIP } from '../afip.service';
import { roundToTwoDecimals } from '../../core/money';
import { formatInternalCreditNoteNumber } from '../../engines/credit-purchase.engine';
import { CREDIT_NOTE_DETAIL_INCLUDE } from './credit-note.service';
import {
  resolveCreditNoteAfipDocMeta,
  restoreReturnedStockAndLots,
  validateCreditNoteAgainstLinkedOrder,
} from './credit-note-stock.helper';
import { recordLedgerMovement } from '../ledger/account-ledger.service';

const activeCreditNoteApprovalLocks = new Map<number, Promise<any>>();

async function withCreditNoteApprovalLock<T>(
  creditNoteId: number,
  task: () => Promise<T>,
): Promise<T> {
  const prev = activeCreditNoteApprovalLocks.get(creditNoteId) ?? Promise.resolve();
  const current = prev.catch(() => undefined).then(() => task());
  activeCreditNoteApprovalLocks.set(creditNoteId, current);
  try {
    return await current;
  } finally {
    if (activeCreditNoteApprovalLocks.get(creditNoteId) === current) {
      activeCreditNoteApprovalLocks.delete(creditNoteId);
    }
  }
}

export const creditNoteApprovalService = {
  async approveCreditNote(params: { id: number; adminId: number }) {
    return withCreditNoteApprovalLock(params.id, async () => {
    const creditNote = await prisma.creditNote.findUnique({
      where: { id: params.id },
      include: { persona: true, items: true },
    });
    if (!creditNote) throw new AppError('Nota de crédito no encontrada.', 404);
    if (creditNote.status !== CreditNoteStatus.PENDING_APPROVAL) {
      throw new AppError('La nota de crédito no está pendiente de aprobación.', 400);
    }

    for (const item of creditNote.items) {
      const product = await prisma.product.findUnique({ where: { id: item.productId } });
      if (!product) {
        throw new AppError(
          `El producto ID ${item.productId} de la nota de crédito ya no existe en el sistema.`,
          400,
        );
      }
    }

    const totalAmount = roundToTwoDecimals(creditNote.totalAmount.toString()).toNumber();
    const isOfficial = creditNote.billingType === BillingType.OFFICIAL;
    if (isOfficial && !creditNote.orderId) {
      throw new AppError(
        'No se puede aprobar una Nota de Crédito Oficial (ARCA/AFIP) sin una factura asociada.',
        400,
      );
    }
    const linkedOrder = creditNote.orderId
      ? await validateCreditNoteAgainstLinkedOrder(prisma, {
          orderId: creditNote.orderId,
          personaId: creditNote.personaId,
          reason: creditNote.reason,
          newLines: creditNote.items.map((i) => ({
            productId: i.productId,
            quantity: i.quantity,
            weight: i.weight !== null && i.weight !== undefined ? Number(i.weight) : null,
          })),
          newTotalAmount: totalAmount,
          excludeCreditNoteId: creditNote.id,
        })
      : null;

    let creditNoteNumber: string | null = null;
    let cae: string | null = null;
    let caeDueDate: Date | null = null;

    if (isOfficial) {
      try {
        const afipMeta = resolveCreditNoteAfipDocMeta(
          creditNote.persona.cuit,
          (creditNote.persona as any).taxCondition,
        );
        const afipRes = await emitirNotaCreditoAFIP({
          clientCuit: afipMeta.cleanCuit,
          clientDocType: afipMeta.docType,
          invoiceType: afipMeta.isA ? 'A' : 'B',
          total: totalAmount,
          neto: afipMeta.isA ? Number(creditNote.netAmount) : undefined,
          iva: afipMeta.isA ? Number(creditNote.taxAmount) : undefined,
          percepcionAmount: afipMeta.isA ? Number((creditNote as any).percepcionAmount || 0) : undefined,
          percepcionIvaAmount: afipMeta.isA ? Number((creditNote as any).percepcionIvaAmount || 0) : undefined,
          associatedVoucher: linkedOrder
            ? {
                invoiceNumber: linkedOrder.invoiceNumber,
                invoiceType: linkedOrder.invoiceType,
                invoiceDate: linkedOrder.invoicedAt ?? linkedOrder.createdAt,
              }
            : null,
        });
        creditNoteNumber = afipRes.invoiceNumber;
        cae = afipRes.cae;
        caeDueDate = afipRes.caeDueDate;
      } catch (err: any) {
        throw new AppError(`Error AFIP al aprobar nota de crédito: ${err.message}`, 400);
      }
    } else {
      creditNoteNumber = formatInternalCreditNoteNumber(creditNote.movementId);
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "CreditNote" WHERE id = ${creditNote.id} FOR UPDATE`;
      const freshCn = await tx.creditNote.findUnique({ where: { id: creditNote.id } });
      if (!freshCn || freshCn.status !== CreditNoteStatus.PENDING_APPROVAL) {
        throw new AppError('La nota de crédito ya fue procesada por otra operación.', 409);
      }

      if (creditNote.orderId) {
        await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${creditNote.orderId} FOR UPDATE`;
        await validateCreditNoteAgainstLinkedOrder(tx, {
          orderId: creditNote.orderId,
          personaId: creditNote.personaId,
          reason: creditNote.reason,
          newLines: creditNote.items.map((i) => ({
            productId: i.productId,
            quantity: i.quantity,
            weight: i.weight !== null && i.weight !== undefined ? Number(i.weight) : null,
          })),
          newTotalAmount: totalAmount,
          excludeCreditNoteId: creditNote.id,
        });
      }

      const approved = await tx.creditNote.update({
        where: { id: creditNote.id },
        data: {
          status: CreditNoteStatus.APPROVED,
          creditNoteNumber,
          cae,
          caeDueDate,
        },
        include: CREDIT_NOTE_DETAIL_INCLUDE,
      });

      if (creditNote.reason === 'DEVOLUCION') {
        await restoreReturnedStockAndLots(tx, {
          creditNoteId: creditNote.id,
          creditNoteNumber,
          orderId: creditNote.orderId,
          userId: params.adminId,
          reasonLabel: `Devolución (Aprobación NC #${creditNoteNumber})`,
          items: creditNote.items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
        });
      }

      await recordLedgerMovement(tx, {
        personaId: creditNote.personaId,
        entryType: LedgerEntryType.CREDIT,
        sourceType: LedgerSourceType.CREDIT_NOTE,
        billingType: creditNote.billingType,
        amount: totalAmount,
        creditNoteId: creditNote.id,
        orderId: creditNote.orderId,
        userId: params.adminId,
        reference: `Nota de Crédito #${creditNote.id}`,
        description: `${creditNote.creditNoteType.replace(/_/g, ' ')} ${creditNoteNumber} (${creditNote.reason})`,
      });

      return approved;
    });

    await logAudit({
      userId: params.adminId,
      action: 'APPROVE_CREDIT_NOTE',
      entityType: 'CreditNote',
      entityId: updated.id,
      newValues: updated,
    });

    return updated;
    });
  },

  async rejectCreditNote(params: { id: number; adminId: number }) {
    const creditNote = await prisma.creditNote.findUnique({ where: { id: params.id } });
    if (!creditNote) throw new AppError('Nota de crédito no encontrada.', 404);
    if (creditNote.status !== CreditNoteStatus.PENDING_APPROVAL) {
      throw new AppError('La nota de crédito no está pendiente de aprobación.', 400);
    }

    const updated = await prisma.creditNote.update({
      where: { id: creditNote.id },
      data: { status: CreditNoteStatus.REJECTED },
      include: CREDIT_NOTE_DETAIL_INCLUDE,
    });

    await logAudit({
      userId: params.adminId,
      action: 'REJECT_CREDIT_NOTE',
      entityType: 'CreditNote',
      entityId: updated.id,
      newValues: updated,
    });

    return updated;
  },
};
