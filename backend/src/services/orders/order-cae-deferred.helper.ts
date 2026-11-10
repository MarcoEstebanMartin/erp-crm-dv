import prisma from '../../utils/prisma';
import { BillingType, InvoiceType } from '@prisma/client';
import { emitirFacturaAFIP } from '../afip.service';
import {
  executeWithResilientRetry,
  isTransientExternalError,
} from '../resilience/external-integrations-retry.service';

export async function resolveAfipCaeOrContingency(params: {
  orderId: number;
  billingType: BillingType;
  deferCae?: boolean;
  finalInvoiceType: InvoiceType;
  cuitLimpio: string;
  docType: number;
  officialOrderTotal: number;
  isFacturaAOfficial: boolean;
  net: number;
  tax: number;
  percepIIBB: number;
  percepIVA: number;
}): Promise<{
  finalInvoiceNumber: string;
  finalCae: string | null;
  finalCaeDueDate: Date | null;
  shouldEnqueueDeferredCae: boolean;
}> {
  if (params.billingType !== BillingType.OFFICIAL) {
    return {
      finalInvoiceNumber: `INT-${params.orderId.toString().padStart(5, '0')}`,
      finalCae: null,
      finalCaeDueDate: null,
      shouldEnqueueDeferredCae: false,
    };
  }

  const preNumber = `PRE-${params.finalInvoiceType === InvoiceType.FACTURA_A ? 'A' : 'B'}-${params.orderId.toString().padStart(6, '0')}`;
  if (params.deferCae) {
    return {
      finalInvoiceNumber: preNumber,
      finalCae: null,
      finalCaeDueDate: null,
      shouldEnqueueDeferredCae: true,
    };
  }

  try {
    const afipRes = await executeWithResilientRetry(
      () =>
        emitirFacturaAFIP({
          clientCuit: params.cuitLimpio,
          clientDocType: params.docType,
          invoiceType: params.finalInvoiceType === InvoiceType.FACTURA_A ? 'A' : 'B',
          total: params.officialOrderTotal,
          neto: params.isFacturaAOfficial ? params.net : undefined,
          iva: params.isFacturaAOfficial ? params.tax : undefined,
          percepcionAmount: params.isFacturaAOfficial ? params.percepIIBB : undefined,
          percepcionIvaAmount: params.isFacturaAOfficial ? params.percepIVA : undefined,
        }),
      {
        maxAttempts: 2,
        baseDelayMs: 700,
        maxDelayMs: 2_000,
        isRetryable: isTransientExternalError,
      },
    );

    return {
      finalInvoiceNumber: afipRes.invoiceNumber,
      finalCae: afipRes.cae,
      finalCaeDueDate: afipRes.caeDueDate,
      shouldEnqueueDeferredCae: false,
    };
  } catch (err: any) {
    if (isTransientExternalError(err) && process.env.AFIP_CONTINGENCY_FALLBACK !== 'false') {
      return {
        finalInvoiceNumber: preNumber,
        finalCae: null,
        finalCaeDueDate: null,
        shouldEnqueueDeferredCae: true,
      };
    }
    throw new Error(`Error AFIP al facturar pedido: ${err.message}`);
  }
}

export async function executeDeferredCaeRequest(orderId: number) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { persona: true },
  });

  if (!order) {
    const err: any = new Error('Pedido no encontrado.');
    err.statusCode = 404;
    throw err;
  }

  if (order.cae) {
    throw new Error(`Este pedido ya posee CAE asignado (CAE: ${order.cae}).`);
  }

  if (order.billingType !== BillingType.OFFICIAL) {
    throw new Error('Solo se puede solicitar CAE para comprobantes de Sucursal A (Oficial).');
  }

  const cuitLimpio = (order.persona.cuit || '').replace(/\D/g, '');
  const isFacturaA = order.invoiceType === InvoiceType.FACTURA_A;
  const docType = cuitLimpio.length === 11 ? 80 : 96;

  const afipRes = await executeWithResilientRetry(
    () =>
      emitirFacturaAFIP({
        clientCuit: cuitLimpio || '20000000001',
        clientDocType: docType,
        invoiceType: isFacturaA ? 'A' : 'B',
        total: Number(order.totalAmount),
        neto: Number(order.netAmount || 0),
        iva: Number(order.taxAmount || 0),
        percepcionAmount: Number(order.percepcionAmount || 0),
        percepcionIvaAmount: Number(order.percepcionIvaAmount || 0),
      }),
    {
      maxAttempts: 2,
      baseDelayMs: 800,
      maxDelayMs: 2_500,
      isRetryable: isTransientExternalError,
    },
  );

  const updated = await prisma.order.update({
    where: { id: order.id },
    data: {
      invoiceNumber: afipRes.invoiceNumber,
      cae: afipRes.cae,
      caeDueDate: afipRes.caeDueDate ? new Date(afipRes.caeDueDate) : null,
    },
    include: { items: { include: { product: true } }, persona: true },
  });

  return {
    updated,
    invoiceNumber: afipRes.invoiceNumber,
    cae: afipRes.cae,
  };
}
