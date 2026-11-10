import { BillingType } from '@prisma/client';
import prisma from '../../utils/prisma';
import AppError from '../../utils/AppError';
import { logAudit } from '../../utils/audit';
import { roundToTwoDecimals } from '../../core/money';
import { calculateSupplierInvoiceBreakdown } from '../../engines/credit-purchase.engine';
import { recordSupplierInvoicePerceptions } from './supplier-tax.helper';

export const supplierInvoiceService = {
  async getSalesInvoices(query: { startDate?: string; endDate?: string; query?: string }) {
    const whereClause: Record<string, any> = {
      status: 'DELIVERED',
      invoiceNumber: { not: null },
    };

    if (query.startDate && query.endDate) {
      whereClause.createdAt = {
        gte: new Date(String(query.startDate)),
        lte: new Date(String(query.endDate)),
      };
    }
    if (query.query) {
      const q = String(query.query);
      whereClause.OR = [
        { invoiceNumber: { contains: q, mode: 'insensitive' } },
        { persona: { name: { contains: q, mode: 'insensitive' } } },
        { persona: { cuit: { contains: q } } },
      ];
    }

    return prisma.order.findMany({
      where: whereClause,
      include: {
        persona: true,
        seller: { select: { id: true, username: true, role: true } },
        items: {
          include: {
            product: { select: { id: true, name: true, sku: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  },

  async getSupplierInvoices(query: { startDate?: string; endDate?: string; query?: string }) {
    const whereClause: Record<string, any> = {};

    if (query.startDate && query.endDate) {
      whereClause.issueDate = {
        gte: new Date(String(query.startDate)),
        lte: new Date(String(query.endDate)),
      };
    }
    if (query.query) {
      const q = String(query.query);
      whereClause.OR = [
        { invoiceNumber: { contains: q, mode: 'insensitive' } },
        { persona: { name: { contains: q, mode: 'insensitive' } } },
        { persona: { cuit: { contains: q } } },
      ];
    }

    return prisma.supplierInvoice.findMany({
      where: whereClause,
      include: { persona: true },
      orderBy: { issueDate: 'desc' },
    });
  },

  async createSupplierInvoice(params: {
    userId?: number;
    personaId: number;
    invoiceNumber: string;
    invoiceType: string;
    issueDate: string;
    dueDate?: string | null;
    netAmount: number;
    taxAmount: number;
    percepcionAmount?: number | null;
    percepcionPampa?: number | null;
    percepcionBsAs?: number | null;
    percepcionIva?: number | null;
    percepcionIva5329?: number | null;
    impuestosInternos?: number | null;
    totalAmount: number;
    billingType?: string;
  }) {
    const providerId = Number(params.personaId);
    const cleanInvoiceNumber = params.invoiceNumber.trim();

    const existingInvoice = await prisma.supplierInvoice.findFirst({
      where: { personaId: providerId, invoiceNumber: cleanInvoiceNumber },
    });
    if (existingInvoice) {
      throw new AppError(
        `La factura Nro ${cleanInvoiceNumber} ya se encuentra registrada para este proveedor.`,
        400,
      );
    }

    const issueDt = new Date(params.issueDate);
    const resolvedDueDate = params.dueDate
      ? new Date(params.dueDate)
      : new Date(issueDt.getTime() + 30 * 24 * 3600 * 1000);

    const breakdown = calculateSupplierInvoiceBreakdown({
      netAmount: params.netAmount,
      taxAmount: params.taxAmount,
      percepcionAmount: params.percepcionAmount ?? 0,
      percepcionPampa: params.percepcionPampa ?? 0,
      percepcionBsAs: params.percepcionBsAs ?? 0,
      percepcionIva: params.percepcionIva ?? 0,
      percepcionIva5329: params.percepcionIva5329 ?? 0,
      impuestosInternos: params.impuestosInternos ?? 0,
      totalAmount: params.totalAmount,
    });

    const invoice = await prisma.$transaction(async (tx) => {
      const inv = await tx.supplierInvoice.create({
        data: {
          personaId: providerId,
          invoiceNumber: cleanInvoiceNumber,
          invoiceType: params.invoiceType,
          issueDate: issueDt,
          dueDate: resolvedDueDate,
          status: 'PENDING',
          paidAmount: 0,
          netAmount: breakdown.netAmount,
          taxAmount: breakdown.taxAmount,
          percepcionAmount: breakdown.finalIIBB,
          percepcionIvaAmount: breakdown.totalPercIva,
          impuestosInternos: breakdown.impuestosInternos,
          totalAmount: breakdown.totalAmount,
          billingType:
            params.billingType === BillingType.INTERNAL
              ? BillingType.INTERNAL
              : BillingType.OFFICIAL,
        },
      });

      await tx.persona.update({
        where: { id: providerId },
        data: { outstandingBalance: { decrement: breakdown.totalAmount } },
      });

      await recordSupplierInvoicePerceptions(tx, {
        personaId: providerId,
        invoiceNumber: cleanInvoiceNumber,
        invoiceDate: issueDt,
        pampa: breakdown.pampa,
        bsas: breakdown.bsas,
        finalIIBB: breakdown.finalIIBB,
        iva3337: breakdown.iva3337,
        iva5329: breakdown.iva5329,
        fallbackJurisdiction: 'AR-B',
      });

      return inv;
    });

    if (params.userId) {
      await logAudit({
        userId: params.userId,
        action: 'CREATE_SUPPLIER_INVOICE',
        entityType: 'SupplierInvoice',
        entityId: invoice.id,
        newValues: invoice,
      });
    }

    return invoice;
  },

  async deleteSupplierInvoice(params: { userId?: number; invoiceId: number }) {
    if (isNaN(params.invoiceId)) {
      throw new AppError('ID de factura inválido.', 400);
    }

    const invoice = await prisma.supplierInvoice.findUnique({
      where: { id: params.invoiceId },
      include: { persona: true },
    });
    if (!invoice) {
      throw new AppError('Factura de compra no encontrada.', 404);
    }

    const paidAmt = roundToTwoDecimals(invoice.paidAmount.toString()).toNumber();
    if (invoice.status !== 'PENDING' || paidAmt > 0) {
      throw new AppError(
        'No se puede eliminar una factura que ya ha sido saldada o pagada parcialmente. Anule los pagos asociados primero.',
        400,
      );
    }

    const amountToRestore = roundToTwoDecimals(invoice.totalAmount.toString()).toNumber();

    await prisma.$transaction(async (tx) => {
      await tx.persona.update({
        where: { id: invoice.personaId },
        data: { outstandingBalance: { increment: amountToRestore } },
      });

      const refId = `INV-${invoice.id}`;
      const stockMovements = await tx.stockMovement.findMany({ where: { referenceId: refId } });

      for (const movement of stockMovements) {
        await tx.product.update({
          where: { id: movement.productId },
          data: { stock: { decrement: movement.quantity } },
        });

        const targetLot = movement.productLotId
          ? await tx.productLot.findUnique({ where: { id: movement.productLotId } })
          : await tx.productLot.findFirst({
              where: { productId: movement.productId, lotNumber: invoice.invoiceNumber },
            });

        if (targetLot) {
          await tx.productLot.update({
            where: { id: targetLot.id },
            data: { stock: { decrement: movement.quantity } },
          });
        }

        await tx.stockMovement.delete({ where: { id: movement.id } });
      }

      await tx.taxWithholding.deleteMany({
        where: {
          personaId: invoice.personaId,
          number: invoice.invoiceNumber,
          type: 'PERCEPCION_SUFRIDA',
        },
      });

      await tx.supplierInvoice.delete({ where: { id: invoice.id } });
    });

    if (params.userId) {
      await logAudit({
        userId: params.userId,
        action: 'DELETE_SUPPLIER_INVOICE',
        entityType: 'SupplierInvoice',
        entityId: invoice.id,
        oldValues: invoice,
      });
    }
  },
};
