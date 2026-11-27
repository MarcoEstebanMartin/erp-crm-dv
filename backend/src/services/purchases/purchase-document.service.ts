import { BillingType, LedgerEntryType, LedgerSourceType } from '@prisma/client';
import prisma from '../../utils/prisma';
import AppError from '../../utils/AppError';
import { geminiService } from '../gemini.service';
import { calculateSupplierInvoiceBreakdown } from '../../engines/credit-purchase.engine';
import { normalizeExtractedInvoiceItems } from '../../engines/purchase-invoice-extraction.engine';
import { recordSupplierInvoicePerceptions } from '../billing/supplier-tax.helper';
import { findMatchedProduct } from './purchase-matcher.helper';
import { createLinkedPurchaseReceptionInTx } from './purchase-stock-tx.helper';
import { recordLedgerMovement } from '../ledger/account-ledger.service';

const COMPANY_CUIT_CLEAN = '20163165059';

export type PurchaseReceptionMode = 'IN_TRANSIT' | 'IMMEDIATE' | 'NONE';

export const purchaseDocumentService = {
  async uploadAndExtractDocument(params: { mimeType: string; fileBuffer: Buffer }) {
    const base64Data = params.fileBuffer.toString('base64');
    const extractedData = await geminiService.extractInvoiceData(params.mimeType, base64Data);

    let matchedProvider = null;
    if (extractedData.cuit) {
      const cuitClean = extractedData.cuit.replace(/\D/g, '');
      const formattedCuit =
        cuitClean.length === 11
          ? `${cuitClean.substring(0, 2)}-${cuitClean.substring(2, 10)}-${cuitClean.substring(10)}`
          : cuitClean;

      matchedProvider = await prisma.persona.findFirst({
        where: {
          OR: [{ cuit: cuitClean }, { cuit: formattedCuit }, { cuit: { contains: cuitClean } }],
          isProvider: true,
        },
      });
    }

    if (!matchedProvider && extractedData.supplierName) {
      matchedProvider = await prisma.persona.findFirst({
        where: {
          name: { contains: extractedData.supplierName, mode: 'insensitive' },
          isProvider: true,
        },
      });
    }

    const receiverCuitClean = extractedData.receiverCuit
      ? extractedData.receiverCuit.replace(/\D/g, '')
      : '';
    const isOfficialInvoice = [
      'FACTURA_A',
      'FACTURA_B',
      'FACTURA_C',
      'NOTA_CREDITO_A',
      'NOTA_CREDITO_B',
      'NOTA_CREDITO_C',
    ].includes(extractedData.documentType);
    const upperReceiver = extractedData.receiverName?.toUpperCase() || '';
    const matchesCompany =
      receiverCuitClean === COMPANY_CUIT_CLEAN ||
      upperReceiver.includes('MARTIN PABLO') ||
      upperReceiver.includes('DON VENANCIO');

    const defaultBillingType: 'OFFICIAL' | 'INTERNAL' =
      isOfficialInvoice && matchesCompany ? 'OFFICIAL' : 'INTERNAL';

    const providerId = matchedProvider ? matchedProvider.id : null;
    const normalizedItems = normalizeExtractedInvoiceItems({
      items: extractedData.items,
      netAmount: extractedData.netAmount,
    });
    const enrichedItems = await Promise.all(
      normalizedItems.map(async (item) => {
        if (item.isNonStock) {
          return {
            ...item,
            matchedProductId: null,
            matchedProductName: null,
            matchedProductUnitsPerBox: 1,
            matchMethod: 'NON_STOCK',
          };
        }
        const { matchedProduct, matchMethod } = await findMatchedProduct(
          providerId,
          item,
          matchedProvider ? matchedProvider.name : null,
        );
        return {
          ...item,
          matchedProductId: matchedProduct ? matchedProduct.id : null,
          matchedProductName: matchedProduct ? matchedProduct.name : null,
          matchedProductUnitsPerBox: matchedProduct?.unitsPerBox ?? 1,
          matchMethod,
        };
      }),
    );

    return {
      extracted: {
        ...extractedData,
        items: enrichedItems,
        billingType: defaultBillingType,
      },
      matchedProvider,
    };
  },

  async confirmExtractedDocument(params: {
    userId: number;
    providerId: number;
    documentType: string;
    documentNumber?: string | null;
    issueDate?: string | null;
    dueDate?: string | null;
    receptionMode?: PurchaseReceptionMode;
    items: any[];
    netAmount?: number | null;
    taxAmount?: number | null;
    percepcionAmount?: number | null;
    percepcionPampa?: number | null;
    percepcionBsAs?: number | null;
    percepcionIva?: number | null;
    percepcionIvaAmount?: number | null;
    percepcionIva5329?: number | null;
    impuestosInternos?: number | null;
    percepcionJurisdiction?: string | null;
    totalAmount?: number | null;
    billingType?: string;
  }) {
    const providerIdNum = Number(params.providerId);
    const provider = await prisma.persona.findUnique({ where: { id: providerIdNum } });
    if (!provider) {
      throw new AppError('Proveedor no encontrado.', 404);
    }

    const resolvedBilling =
      params.billingType === BillingType.OFFICIAL ? BillingType.OFFICIAL : BillingType.INTERNAL;
    const upperDocType = String(params.documentType || '').trim().toUpperCase();
    const isCreditNoteDoc = upperDocType.startsWith('NOTA_CREDITO');
    const isInvoiceDoc = upperDocType.startsWith('FACTURA');
    const isFiscalDoc = isInvoiceDoc || isCreditNoteDoc;

    if (isFiscalDoc && resolvedBilling === BillingType.OFFICIAL) {
      const cuitDigits = String(provider.cuit || '').replace(/\D/g, '');
      if (cuitDigits.length !== 11) {
        throw new AppError(
          'Para registrar un comprobante en Sucursal A (Oficial), el proveedor debe tener un CUIT válido de 11 dígitos. Completalo en Padrón o usá Sucursal X.',
          400,
        );
      }
    }

    const stockItems = isCreditNoteDoc
      ? []
      : (params.items || []).filter(
          (i: any) => !i.isNonStock && Number(i.productId) > 0 && Math.trunc(Number(i.quantity || 0)) > 0,
        );

    const effectiveMode: PurchaseReceptionMode =
      isCreditNoteDoc || params.receptionMode === 'NONE' || stockItems.length === 0
        ? 'NONE'
        : params.receptionMode === 'IN_TRANSIT'
          ? 'IN_TRANSIT'
          : 'IMMEDIATE';

    const breakdown = calculateSupplierInvoiceBreakdown({
      netAmount: params.netAmount ?? 0,
      taxAmount: params.taxAmount ?? 0,
      percepcionAmount: params.percepcionAmount ?? 0,
      percepcionPampa: params.percepcionPampa ?? 0,
      percepcionBsAs: params.percepcionBsAs ?? 0,
      percepcionIva: params.percepcionIva ?? undefined,
      percepcionIvaAmount: params.percepcionIvaAmount ?? undefined,
      percepcionIva5329: params.percepcionIva5329 ?? 0,
      impuestosInternos: params.impuestosInternos ?? 0,
      totalAmount: params.totalAmount ?? params.netAmount ?? 0,
    });

    return prisma.$transaction(async (tx) => {
      let invoiceId: number | null = null;
      let poId: number | null = null;
      let refId = '';
      const resolvedNumber = params.documentNumber?.trim() || `AI-${Date.now()}`;
      const invoiceDate = new Date(params.issueDate || Date.now());

      for (const item of stockItems) {
        if (!item.code) continue;
        await tx.providerProductMapping.upsert({
          where: {
            providerId_providerCode: {
              providerId: providerIdNum,
              providerCode: String(item.code),
            },
          },
          update: { productId: Number(item.productId), providerName: item.description || '' },
          create: {
            providerId: providerIdNum,
            providerCode: String(item.code),
            productId: Number(item.productId),
            providerName: item.description || '',
          },
        });
      }

      if (isFiscalDoc) {
        if (params.documentNumber?.trim()) {
          const existingInvoice = await tx.supplierInvoice.findFirst({
            where: { personaId: providerIdNum, invoiceNumber: params.documentNumber.trim() },
          });
          if (existingInvoice) {
            throw new AppError(
              `El comprobante Nro ${params.documentNumber} ya se encuentra registrado para este proveedor.`,
              400,
            );
          }
        }

        const termDays = provider.paymentTermDays ?? 30;
        const resolvedDueDate = params.dueDate
          ? new Date(params.dueDate)
          : new Date(invoiceDate.getTime() + termDays * 24 * 3600 * 1000);
        const receptionStatus =
          effectiveMode === 'NONE'
            ? 'NONE'
            : effectiveMode === 'IN_TRANSIT'
              ? 'IN_TRANSIT'
              : 'RECEIVED';

        const invoice = await tx.supplierInvoice.create({
          data: {
            personaId: providerIdNum,
            invoiceNumber: resolvedNumber,
            invoiceType: params.documentType,
            issueDate: invoiceDate,
            dueDate: resolvedDueDate,
            netAmount: breakdown.netAmount,
            taxAmount: breakdown.taxAmount,
            percepcionAmount: breakdown.finalIIBB,
            percepcionIvaAmount: breakdown.totalPercIva,
            impuestosInternos: breakdown.impuestosInternos,
            totalAmount: breakdown.totalAmount,
            status: isCreditNoteDoc ? 'PAID' : 'PENDING',
            paidAmount: isCreditNoteDoc ? breakdown.totalAmount : 0,
            billingType: resolvedBilling,
            receptionStatus,
            receivedAt: effectiveMode === 'IMMEDIATE' ? new Date() : null,
          },
        });
        invoiceId = invoice.id;
        refId = `INV-${invoice.id}`;

        if (!isCreditNoteDoc) {
          await recordSupplierInvoicePerceptions(tx, {
            personaId: providerIdNum,
            invoiceNumber: resolvedNumber,
            invoiceDate,
            pampa: breakdown.pampa,
            bsas: breakdown.bsas,
            finalIIBB: breakdown.finalIIBB,
            iva3337: breakdown.iva3337,
            iva5329: breakdown.iva5329,
            fallbackJurisdiction: params.percepcionJurisdiction,
          });
        }
      }

      if (!isCreditNoteDoc && (effectiveMode === 'IN_TRANSIT' || effectiveMode === 'IMMEDIATE' || !isFiscalDoc)) {
        const po = await createLinkedPurchaseReceptionInTx(tx, {
          userId: params.userId,
          personaId: providerIdNum,
          supplierInvoiceId: invoiceId,
          mode: effectiveMode === 'IN_TRANSIT' ? 'IN_TRANSIT' : 'IMMEDIATE',
          reason: `Ingreso por ${params.documentType}`,
          fallbackTotal: isFiscalDoc ? undefined : breakdown.totalAmount,
          items: stockItems.map((item: any) => ({
            productId: Number(item.productId),
            quantity: Math.trunc(Number(item.quantity)),
            unitCost: Number(item.unitPrice || 0),
            lotNumber: item.lotNumber,
            expirationDate: item.expirationDate,
          })),
        });
        poId = po.id;
        if (!refId) refId = `PO-${po.id}`;
      }

      const docNumLabel = params.documentNumber?.trim() || `#${invoiceId || poId}`;
      if (isCreditNoteDoc) {
        await recordLedgerMovement(tx, {
          personaId: providerIdNum,
          entryType: LedgerEntryType.DEBIT,
          sourceType: LedgerSourceType.SUPPLIER_INVOICE,
          billingType: resolvedBilling,
          amount: breakdown.totalAmount,
          supplierInvoiceId: invoiceId,
          purchaseOrderId: null,
          userId: params.userId,
          occurredAt: invoiceDate,
          reference: `Nota de Crédito Nro ${docNumLabel}`,
          description: `Nota de Crédito - ${params.documentType} ${docNumLabel}`,
        });
      } else if (isInvoiceDoc || effectiveMode === 'IMMEDIATE') {
        await recordLedgerMovement(tx, {
          personaId: providerIdNum,
          entryType: LedgerEntryType.CREDIT,
          sourceType: LedgerSourceType.SUPPLIER_INVOICE,
          billingType: resolvedBilling,
          amount: breakdown.totalAmount,
          supplierInvoiceId: invoiceId,
          purchaseOrderId: poId,
          userId: params.userId,
          occurredAt: isInvoiceDoc ? invoiceDate : new Date(),
          reference: `${isInvoiceDoc ? 'Factura Nro' : 'Remito Nro'} ${docNumLabel}`,
          description: `Compra - ${isInvoiceDoc ? 'Factura' : 'Remito'} ${docNumLabel}`,
        });
      }

      return {
        createdId: invoiceId || poId || 0,
        supplierInvoiceId: invoiceId,
        purchaseOrderId: poId,
        refId,
        receptionMode: effectiveMode,
      };
    });
  },
};
