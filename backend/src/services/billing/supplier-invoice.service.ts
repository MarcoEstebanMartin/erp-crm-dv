import { BillingType, LedgerEntryType, LedgerSourceType } from '@prisma/client';
import prisma from '../../utils/prisma';
import AppError from '../../utils/AppError';
import { logAudit } from '../../utils/audit';
import { roundToTwoDecimals } from '../../core/money';
import { calculateSupplierInvoiceBreakdown } from '../../engines/credit-purchase.engine';
import {
  createLinkedPurchaseReceptionInTx,
  revertSupplierInvoiceStockInTx,
} from '../purchases/purchase-stock-tx.helper';
import { recordSupplierInvoicePerceptions } from './supplier-tax.helper';
import { recordLedgerMovement } from '../ledger/account-ledger.service';
import { parseArgentinaTimestampRange, parseCalendarDateRange } from './billing-date-range.helper';

export const supplierInvoiceService = {
  async getSalesInvoices(query: {
    startDate?: string;
    endDate?: string;
    query?: string;
    billingType?: string;
  }) {
    const whereClause: Record<string, any> = {
      status: 'DELIVERED',
      invoiceNumber: { not: null },
    };

    const dateRange = parseArgentinaTimestampRange(query.startDate, query.endDate);
    if (dateRange) {
      whereClause.createdAt = dateRange;
    }

    if (query.billingType === BillingType.OFFICIAL || query.billingType === BillingType.INTERNAL) {
      whereClause.billingType = query.billingType as BillingType;
    }

    const rawQ = typeof query.query === 'string' ? query.query.trim() : '';
    if (rawQ) {
      const orFilters: any[] = [
        { invoiceNumber: { contains: rawQ, mode: 'insensitive' } },
        { persona: { name: { contains: rawQ, mode: 'insensitive' } } },
        { persona: { cuit: { contains: rawQ } } },
      ];
      if (/^#?\d+$/.test(rawQ)) {
        const numericId = Number(rawQ.replace(/^#/, ''));
        if (Number.isInteger(numericId) && numericId > 0) {
          orFilters.push({ id: numericId });
        }
      }
      whereClause.OR = orFilters;
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

    const issueDateRange = parseCalendarDateRange(query.startDate, query.endDate);
    if (issueDateRange) {
      whereClause.issueDate = issueDateRange;
    }

    const rawQ = typeof query.query === 'string' ? query.query.trim() : '';
    if (rawQ) {
      whereClause.OR = [
        { invoiceNumber: { contains: rawQ, mode: 'insensitive' } },
        { persona: { name: { contains: rawQ, mode: 'insensitive' } } },
        { persona: { cuit: { contains: rawQ } } },
      ];
    }

    return prisma.supplierInvoice.findMany({
      where: whereClause,
      include: {
        persona: true,
        purchaseOrder: {
          include: {
            items: {
              include: {
                product: { select: { id: true, name: true, sku: true } },
              },
            },
          },
        },
      },
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
    receptionMode?: 'NONE' | 'IN_TRANSIT' | 'IMMEDIATE';
    items?: Array<{
      productId: number;
      quantity: number;
      costPrice: number;
      lotNumber?: string | null;
      expirationDate?: string | null;
    }>;
  }) {
    const providerId = Number(params.personaId);
    const cleanInvoiceNumber = params.invoiceNumber.trim();
    const resolvedBilling =
      params.billingType === BillingType.INTERNAL ? BillingType.INTERNAL : BillingType.OFFICIAL;

    const provider = await prisma.persona.findUnique({ where: { id: providerId } });
    if (!provider) {
      throw new AppError('Proveedor no encontrado.', 404);
    }
    if (resolvedBilling === BillingType.OFFICIAL) {
      const cuitDigits = String(provider.cuit || '').replace(/\D/g, '');
      if (cuitDigits.length !== 11) {
        throw new AppError(
          'Para registrar una factura en Sucursal A (Oficial), el proveedor debe tener un CUIT válido de 11 dígitos.',
          400,
        );
      }
    }

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

    const isCreditNote = String(params.invoiceType || '').trim().toUpperCase().startsWith('NOTA_CREDITO');
    const stockItems = isCreditNote
      ? []
      : (params.items || []).filter(
          (i) => Number(i.productId) > 0 && Math.trunc(Number(i.quantity || 0)) > 0,
        );
    const effectiveMode =
      isCreditNote
        ? 'NONE'
        : params.receptionMode === 'IN_TRANSIT' && stockItems.length > 0
          ? 'IN_TRANSIT'
          : params.receptionMode === 'IMMEDIATE' && stockItems.length > 0
            ? 'IMMEDIATE'
            : 'NONE';

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
    if (breakdown.totalAmount <= 0) {
      throw new AppError('El total de la factura debe ser mayor a cero.', 400);
    }

    const invoice = await prisma.$transaction(async (tx) => {
      const receptionStatus =
        effectiveMode === 'IN_TRANSIT'
          ? 'IN_TRANSIT'
          : effectiveMode === 'IMMEDIATE'
            ? 'RECEIVED'
            : 'NONE';

      const inv = await tx.supplierInvoice.create({
        data: {
          personaId: providerId,
          invoiceNumber: cleanInvoiceNumber,
          invoiceType: params.invoiceType,
          issueDate: issueDt,
          dueDate: resolvedDueDate,
          status: isCreditNote ? 'PAID' : 'PENDING',
          paidAmount: isCreditNote ? breakdown.totalAmount : 0,
          netAmount: breakdown.netAmount,
          taxAmount: breakdown.taxAmount,
          percepcionAmount: breakdown.finalIIBB,
          percepcionIvaAmount: breakdown.totalPercIva,
          impuestosInternos: breakdown.impuestosInternos,
          totalAmount: breakdown.totalAmount,
          billingType: resolvedBilling,
          receptionStatus,
          receivedAt: effectiveMode === 'IMMEDIATE' ? new Date() : null,
        },
      });

      let poId: number | null = null;
      if (effectiveMode === 'IN_TRANSIT' || effectiveMode === 'IMMEDIATE') {
        const po = await createLinkedPurchaseReceptionInTx(tx, {
          userId: params.userId ?? 1,
          personaId: providerId,
          supplierInvoiceId: inv.id,
          mode: effectiveMode,
          reason: `Ingreso por Factura ${cleanInvoiceNumber}`,
          items: stockItems.map((i) => ({
            productId: Number(i.productId),
            quantity: Math.trunc(Number(i.quantity)),
            unitCost: Number(i.costPrice || 0),
            lotNumber: i.lotNumber,
            expirationDate: i.expirationDate,
          })),
        });
        poId = po.id;
      }

      await recordLedgerMovement(tx, {
        personaId: providerId,
        entryType: isCreditNote ? LedgerEntryType.DEBIT : LedgerEntryType.CREDIT,
        sourceType: LedgerSourceType.SUPPLIER_INVOICE,
        billingType: inv.billingType,
        amount: breakdown.totalAmount,
        supplierInvoiceId: inv.id,
        purchaseOrderId: poId,
        userId: params.userId ?? null,
        occurredAt: issueDt,
        reference: `${isCreditNote ? 'Nota de Crédito Nro' : 'Factura Nro'} ${cleanInvoiceNumber}`,
        description: `${isCreditNote ? 'Nota de Crédito' : 'Compra'} - ${params.invoiceType.replace('_', ' ')}`,
      });

      if (!isCreditNote) {
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
      }

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

    const isCreditNote = String(invoice.invoiceType || '').toUpperCase().startsWith('NOTA_CREDITO');
    const paidAmt = roundToTwoDecimals(invoice.paidAmount.toString()).toNumber();
    if (!isCreditNote && (invoice.status !== 'PENDING' || paidAmt > 0)) {
      throw new AppError(
        'No se puede eliminar una factura que ya ha sido saldada o pagada parcialmente. Anule los pagos asociados primero.',
        400,
      );
    }

    const amountToRestore = roundToTwoDecimals(invoice.totalAmount.toString()).toNumber();

    await prisma.$transaction(async (tx) => {
      await recordLedgerMovement(tx, {
        personaId: invoice.personaId,
        entryType: isCreditNote ? LedgerEntryType.CREDIT : LedgerEntryType.DEBIT,
        sourceType: LedgerSourceType.SUPPLIER_INVOICE_REVERSAL,
        billingType: invoice.billingType,
        amount: amountToRestore,
        userId: params.userId ?? null,
        reference: `Anulación ${isCreditNote ? 'Nota de Crédito' : 'Factura'} Nro ${invoice.invoiceNumber}`,
        description: `Reversión por eliminación de ${isCreditNote ? 'Nota de Crédito' : 'Factura'} ${invoice.invoiceNumber}`,
      });

      await revertSupplierInvoiceStockInTx(tx, {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        userId: params.userId,
      });

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
