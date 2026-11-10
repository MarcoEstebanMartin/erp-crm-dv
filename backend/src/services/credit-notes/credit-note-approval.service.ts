import { BillingType, CreditNoteStatus } from '@prisma/client';
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
} from './credit-note-stock.helper';

export const creditNoteApprovalService = {
  async approveCreditNote(params: { id: number; adminId: number }) {
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
    let creditNoteNumber: string | null = null;
    let cae: string | null = null;
    let caeDueDate: Date | null = null;

    if (isOfficial) {
      try {
        const afipMeta = resolveCreditNoteAfipDocMeta(creditNote.persona.cuit);
        const afipRes = await emitirNotaCreditoAFIP({
          clientCuit: afipMeta.cleanCuit,
          clientDocType: afipMeta.docType,
          invoiceType: afipMeta.isA ? 'A' : 'B',
          total: totalAmount,
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

      await tx.persona.update({
        where: { id: creditNote.personaId },
        data: { outstandingBalance: { decrement: totalAmount } },
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
