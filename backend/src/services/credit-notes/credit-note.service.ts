import { BillingType, CreditNoteStatus, Role } from '@prisma/client';
import prisma from '../../utils/prisma';
import AppError from '../../utils/AppError';
import { logAudit } from '../../utils/audit';
import { emitirNotaCreditoAFIP } from '../afip.service';
import {
  calculateCreditNoteTotals,
  formatInternalCreditNoteNumber,
} from '../../engines/credit-purchase.engine';
import {
  resolveCreditNoteAfipDocMeta,
  restoreReturnedStockAndLots,
} from './credit-note-stock.helper';

export const CREDIT_NOTE_DETAIL_INCLUDE = {
  persona: true,
  user: { select: { id: true, username: true } },
  order: { select: { id: true, invoiceNumber: true } },
  items: { include: { product: true } },
} as const;

export const creditNoteService = {
  async getCreditNotes(query: {
    startDate?: string;
    endDate?: string;
    query?: string;
    status?: string;
  }) {
    const whereClause: Record<string, any> = {};

    if (query.startDate && query.endDate) {
      whereClause.createdAt = {
        gte: new Date(String(query.startDate)),
        lte: new Date(String(query.endDate)),
      };
    }
    if (query.status) {
      whereClause.status = query.status as CreditNoteStatus;
    }
    if (query.query) {
      const q = String(query.query);
      whereClause.OR = [
        { creditNoteNumber: { contains: q, mode: 'insensitive' } },
        { persona: { name: { contains: q, mode: 'insensitive' } } },
        { persona: { cuit: { contains: q } } },
      ];
    }

    return prisma.creditNote.findMany({
      where: whereClause,
      include: CREDIT_NOTE_DETAIL_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  },

  async getCreditNoteById(id: number) {
    if (isNaN(id)) throw new AppError('ID de Nota de Crédito inválido.', 400);
    const creditNote = await prisma.creditNote.findUnique({
      where: { id },
      include: CREDIT_NOTE_DETAIL_INCLUDE,
    });
    if (!creditNote) throw new AppError('Nota de crédito no encontrada.', 404);
    return creditNote;
  },

  async createCreditNote(params: {
    userId: number;
    userRole?: Role;
    personaId: number;
    orderId?: number | null;
    billingType?: string;
    reason: string;
    comments?: string | null;
    items: Array<{
      productId: number;
      quantity: number;
      weight?: number | null;
      unitPrice: number;
    }>;
  }) {
    const persona = await prisma.persona.findUnique({ where: { id: Number(params.personaId) } });
    if (!persona) throw new AppError('El cliente seleccionado no existe.', 404);

    let finalBillingType: BillingType =
      params.billingType === BillingType.OFFICIAL ? BillingType.OFFICIAL : BillingType.INTERNAL;
    const resolvedOrderId = params.orderId ? Number(params.orderId) : null;

    if (resolvedOrderId) {
      const linkedOrder = await prisma.order.findUnique({ where: { id: resolvedOrderId } });
      if (linkedOrder) finalBillingType = linkedOrder.billingType;
    }

    const enrichedInputs = [];
    for (const item of params.items) {
      const product = await prisma.product.findUnique({ where: { id: Number(item.productId) } });
      if (!product) {
        throw new AppError(`El producto con ID ${item.productId} no existe.`, 400);
      }
      enrichedInputs.push({
        productId: product.id,
        quantity: item.quantity,
        weight: item.weight,
        isPesable: product.isPesable,
        approximateWeight: product.approximateWeight?.toString() ?? 1,
        unitPrice: item.unitPrice,
      });
    }

    const isOfficial = finalBillingType === BillingType.OFFICIAL;
    const totals = calculateCreditNoteTotals(enrichedInputs, isOfficial);
    const isAdmin = params.userRole === Role.ADMIN;
    const finalStatus = isAdmin ? CreditNoteStatus.APPROVED : CreditNoteStatus.PENDING_APPROVAL;

    let creditNoteType = 'NOTA_CREDITO_INTERNA';
    let afipNumber: string | null = null;
    let cae: string | null = null;
    let caeDueDate: Date | null = null;

    if (isOfficial) {
      const afipMeta = resolveCreditNoteAfipDocMeta(persona.cuit);
      creditNoteType = afipMeta.creditNoteType;

      if (isAdmin) {
        try {
          const afipRes = await emitirNotaCreditoAFIP({
            clientCuit: afipMeta.cleanCuit,
            clientDocType: afipMeta.docType,
            invoiceType: afipMeta.isA ? 'A' : 'B',
            total: totals.totalAmount,
          });
          afipNumber = afipRes.invoiceNumber;
          cae = afipRes.cae;
          caeDueDate = afipRes.caeDueDate;
        } catch (err: any) {
          throw new AppError(`Error AFIP al emitir nota de crédito: ${err.message}`, 400);
        }
      }
    }

    const createdCreditNote = await prisma.$transaction(async (tx) => {
      let note = await tx.creditNote.create({
        data: {
          personaId: persona.id,
          orderId: resolvedOrderId,
          userId: params.userId,
          status: finalStatus,
          billingType: finalBillingType,
          creditNoteType,
          creditNoteNumber: afipNumber,
          cae,
          caeDueDate,
          totalAmount: totals.totalAmount,
          netAmount: totals.netAmount,
          taxAmount: totals.taxAmount,
          reason: params.reason,
          comments: params.comments ?? null,
        },
      });

      if (!isOfficial && isAdmin) {
        const internalNumber = formatInternalCreditNoteNumber(note.movementId);
        note = await tx.creditNote.update({
          where: { id: note.id },
          data: { creditNoteNumber: internalNumber },
        });
      }

      for (const line of totals.lines) {
        await tx.creditNoteItem.create({
          data: {
            creditNoteId: note.id,
            productId: line.productId,
            quantity: line.quantity,
            weight: line.weight,
            unitPrice: line.unitPrice,
            subtotal: line.subtotal,
          },
        });
      }

      if (isAdmin) {
        if (params.reason === 'DEVOLUCION') {
          await restoreReturnedStockAndLots(tx, {
            creditNoteId: note.id,
            creditNoteNumber: note.creditNoteNumber,
            orderId: resolvedOrderId,
            userId: params.userId,
            reasonLabel: `Devolución del cliente: ${persona.name} (NC #${note.creditNoteNumber})`,
            items: totals.lines.map((l) => ({ productId: l.productId, quantity: l.quantity })),
          });
        }

        await tx.persona.update({
          where: { id: persona.id },
          data: { outstandingBalance: { decrement: totals.totalAmount } },
        });
      }

      return tx.creditNote.findUniqueOrThrow({
        where: { id: note.id },
        include: CREDIT_NOTE_DETAIL_INCLUDE,
      });
    });

    await logAudit({
      userId: params.userId,
      action: 'CREATE_CREDIT_NOTE',
      entityType: 'CreditNote',
      entityId: createdCreditNote.id,
      newValues: createdCreditNote,
    });

    return createdCreditNote;
  },
};
