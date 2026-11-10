import { BillingType, LedgerEntryType, LedgerSourceType } from '@prisma/client';
import prisma from '../../utils/prisma';
import AppError from '../../utils/AppError';
import { geminiService } from '../gemini.service';
import { roundToTwoDecimals } from '../../core/money';
import { calculateSupplierInvoiceBreakdown } from '../../engines/credit-purchase.engine';
import { recordSupplierInvoicePerceptions } from '../billing/supplier-tax.helper';
import { findMatchedProduct } from './purchase-matcher.helper';
import { recordLedgerMovement } from '../ledger/account-ledger.service';

const COMPANY_CUIT_CLEAN = '20163165059';

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
    const isOfficialInvoice = ['FACTURA_A', 'FACTURA_B', 'FACTURA_C'].includes(
      extractedData.documentType,
    );
    const upperReceiver = extractedData.receiverName?.toUpperCase() || '';
    const matchesCompany =
      receiverCuitClean === COMPANY_CUIT_CLEAN ||
      upperReceiver.includes('MARTIN PABLO') ||
      upperReceiver.includes('DON VENANCIO');

    const defaultBillingType: 'OFFICIAL' | 'INTERNAL' =
      isOfficialInvoice && matchesCompany ? 'OFFICIAL' : 'INTERNAL';

    const providerId = matchedProvider ? matchedProvider.id : null;
    const enrichedItems = await Promise.all(
      extractedData.items.map(async (item) => {
        const { matchedProduct, matchMethod } = await findMatchedProduct(
          providerId,
          item,
          matchedProvider ? matchedProvider.name : null,
        );
        return {
          ...item,
          matchedProductId: matchedProduct ? matchedProduct.id : null,
          matchedProductName: matchedProduct ? matchedProduct.name : null,
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
      let createdId = 0;
      let refId = '';
      const resolvedNumber = params.documentNumber?.trim() || `AI-${Date.now()}`;

      if (params.documentType.startsWith('FACTURA')) {
        if (params.documentNumber?.trim()) {
          const existingInvoice = await tx.supplierInvoice.findFirst({
            where: { personaId: providerIdNum, invoiceNumber: params.documentNumber.trim() },
          });
          if (existingInvoice) {
            throw new AppError(
              `La factura Nro ${params.documentNumber} ya se encuentra registrada para este proveedor.`,
              400,
            );
          }
        }

        const invoiceDate = new Date(params.issueDate || Date.now());
        const provider = await tx.persona.findUnique({ where: { id: providerIdNum } });
        const termDays = provider?.paymentTermDays ?? 30;

        const invoice = await tx.supplierInvoice.create({
          data: {
            personaId: providerIdNum,
            invoiceNumber: resolvedNumber,
            invoiceType: params.documentType,
            issueDate: invoiceDate,
            dueDate: new Date(invoiceDate.getTime() + termDays * 24 * 3600 * 1000),
            netAmount: breakdown.netAmount,
            taxAmount: breakdown.taxAmount,
            percepcionAmount: breakdown.finalIIBB,
            percepcionIvaAmount: breakdown.totalPercIva,
            impuestosInternos: breakdown.impuestosInternos,
            totalAmount: breakdown.totalAmount,
            status: 'PENDING',
            paidAmount: 0,
            billingType:
              params.billingType === BillingType.OFFICIAL
                ? BillingType.OFFICIAL
                : BillingType.INTERNAL,
          },
        });
        createdId = invoice.id;
        refId = `INV-${invoice.id}`;

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
      } else {
        const po = await tx.purchaseOrder.create({
          data: {
            personaId: providerIdNum,
            status: 'RECEIVED',
            totalAmount: breakdown.totalAmount,
            items: {
              create: params.items
                .filter((i: any) => i.productId)
                .map((item: any) => ({
                  productId: Number(item.productId),
                  quantity: Number(item.quantity || 0),
                  costPrice: roundToTwoDecimals(item.unitPrice || 0).toNumber(),
                  subtotal: roundToTwoDecimals(item.subtotal || 0).toNumber(),
                })),
            },
          },
        });
        createdId = po.id;
        refId = `PO-${po.id}`;
      }

      const defaultLotNumber = params.documentNumber?.trim() || `LOT-${Date.now()}`;
      const defaultExpiration = new Date(Date.now() + 365 * 24 * 3600 * 1000);

      for (const item of params.items) {
        if (!item.productId || item.isNonStock) continue;
        const productIdNum = Number(item.productId);
        const qty = Number(item.quantity);
        const unitCost =
          Number(item.unitPrice) > 0 ? roundToTwoDecimals(item.unitPrice).toNumber() : undefined;

        await tx.product.update({
          where: { id: productIdNum },
          data: { stock: { increment: qty }, costPrice: unitCost },
        });

        let lot = await tx.productLot.findUnique({
          where: { productId_lotNumber: { productId: productIdNum, lotNumber: defaultLotNumber } },
        });
        lot = lot
          ? await tx.productLot.update({
              where: { id: lot.id },
              data: { stock: { increment: qty } },
            })
          : await tx.productLot.create({
              data: {
                productId: productIdNum,
                lotNumber: defaultLotNumber,
                expirationDate: defaultExpiration,
                stock: qty,
                location: 'S/U',
              },
            });

        if (item.code) {
          await tx.providerProductMapping.upsert({
            where: {
              providerId_providerCode: {
                providerId: providerIdNum,
                providerCode: String(item.code),
              },
            },
            update: { productId: productIdNum, providerName: item.description || '' },
            create: {
              providerId: providerIdNum,
              providerCode: String(item.code),
              productId: productIdNum,
              providerName: item.description || '',
            },
          });
        }

        await tx.stockMovement.create({
          data: {
            productId: productIdNum,
            quantity: qty,
            type: 'IN',
            referenceId: refId,
            userId: params.userId,
            reason: `Ingreso por ${params.documentType}`,
            productLotId: lot.id,
          },
        });
      }

      const resolvedBilling =
        params.billingType === BillingType.OFFICIAL ? BillingType.OFFICIAL : BillingType.INTERNAL;
      const isInvoiceDoc = params.documentType === 'FACTURA';
      const docNumLabel = params.documentNumber?.trim() || `#${createdId}`;

      await recordLedgerMovement(tx, {
        personaId: providerIdNum,
        entryType: LedgerEntryType.CREDIT,
        sourceType: LedgerSourceType.SUPPLIER_INVOICE,
        billingType: resolvedBilling,
        amount: breakdown.totalAmount,
        supplierInvoiceId: isInvoiceDoc ? createdId : null,
        purchaseOrderId: !isInvoiceDoc ? createdId : null,
        userId: params.userId,
        reference: `${isInvoiceDoc ? 'Factura Nro' : 'Remito Nro'} ${docNumLabel}`,
        description: `Compra - ${isInvoiceDoc ? 'Factura' : 'Remito'} ${docNumLabel}`,
      });

      return { createdId, refId };
    });
  },
};
