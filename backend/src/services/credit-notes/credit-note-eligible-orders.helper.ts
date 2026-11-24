import { BillingType, CreditNoteStatus, OrderStatus } from '@prisma/client';
import prisma from '../../utils/prisma';
import AppError from '../../utils/AppError';
import { roundToTwoDecimals, toDecimal } from '../../core/money';

export interface EligibleOrderItemSummary {
  productId: number;
  name: string;
  sku: string;
  isPesable: boolean;
  approximateWeight: number;
  orderQuantity: number;
  alreadyReturnedQuantity: number;
  remainingReturnableQuantity: number;
  orderWeight: number | null;
  unitPrice: number;
  subtotal: number;
}

export interface EligibleOrderForCreditNote {
  id: number;
  invoiceNumber: string | null;
  invoiceType: string;
  billingType: BillingType;
  cae: string | null;
  createdAt: Date;
  invoicedAt: Date | null;
  totalAmount: number;
  alreadyCreditedAmount: number;
  remainingCreditableAmount: number;
  items: EligibleOrderItemSummary[];
}

/**
 * Calcula con precisión Decimal.js cuánto dinero y cuántas unidades quedan disponibles
 * para acreditar/devolver sobre una factura, descontando NC aprobadas o pendientes.
 * Devuelve `null` si la factura ya fue acreditada al 100% o no es elegible.
 */
export function computeEligibleOrderSummary(
  order: any,
  existingNotes: any[],
): EligibleOrderForCreditNote | null {
  if (!order || order.status === OrderStatus.CANCELLED) return null;
  if (order.billingType === BillingType.OFFICIAL && !order.cae) return null;

  const totalAmountDec = roundToTwoDecimals(order.totalAmount?.toString() ?? 0);
  if (totalAmountDec.lte(0)) return null;

  let alreadyCreditedDec = toDecimal(0);
  const alreadyReturnedByProduct = new Map<number, number>();

  for (const note of existingNotes || []) {
    if (
      note.status !== CreditNoteStatus.APPROVED &&
      note.status !== CreditNoteStatus.PENDING_APPROVAL
    ) {
      continue;
    }
    alreadyCreditedDec = alreadyCreditedDec.plus(toDecimal(note.totalAmount?.toString() ?? 0));

    if (note.reason === 'DEVOLUCION' && Array.isArray(note.items)) {
      for (const noteItem of note.items) {
        const pid = Number(noteItem.productId);
        alreadyReturnedByProduct.set(
          pid,
          (alreadyReturnedByProduct.get(pid) ?? 0) + Number(noteItem.quantity || 0),
        );
      }
    }
  }

  alreadyCreditedDec = roundToTwoDecimals(alreadyCreditedDec);
  const remainingCreditableDec = roundToTwoDecimals(totalAmountDec.minus(alreadyCreditedDec));

  if (remainingCreditableDec.lte(0)) {
    return null;
  }

  // Agrupamos devoluciones consumidas en caso de que la misma factura tenga más de un renglón del mismo producto
  const remainingPoolToDeduct = new Map<number, number>(alreadyReturnedByProduct);

  const items: EligibleOrderItemSummary[] = (order.items || []).map((item: any) => {
    const pid = Number(item.productId);
    const orderQuantity = Number(item.quantity || 0);
    const pool = remainingPoolToDeduct.get(pid) ?? 0;
    const returnedOnThisLine = Math.min(orderQuantity, pool);
    remainingPoolToDeduct.set(pid, Math.max(0, pool - returnedOnThisLine));

    const remainingReturnableQuantity = Math.max(0, orderQuantity - returnedOnThisLine);
    const unitPrice = roundToTwoDecimals(item.unitPrice?.toString() ?? 0).toNumber();
    const subtotal = roundToTwoDecimals(item.subtotal?.toString() ?? 0).toNumber();
    const orderWeight =
      item.weight !== null && item.weight !== undefined ? Number(item.weight) : null;

    return {
      productId: pid,
      name: item.product?.name || `Producto #${pid}`,
      sku: item.product?.sku || '',
      isPesable: Boolean(item.product?.isPesable),
      approximateWeight: Number(item.product?.approximateWeight ?? 1),
      orderQuantity,
      alreadyReturnedQuantity: returnedOnThisLine,
      remainingReturnableQuantity,
      orderWeight,
      unitPrice,
      subtotal,
    };
  });

  return {
    id: order.id,
    invoiceNumber: order.invoiceNumber ?? null,
    invoiceType: String(order.invoiceType || ''),
    billingType: order.billingType,
    cae: order.cae ?? null,
    createdAt: order.createdAt,
    invoicedAt: order.invoicedAt ?? null,
    totalAmount: totalAmountDec.toNumber(),
    alreadyCreditedAmount: alreadyCreditedDec.toNumber(),
    remainingCreditableAmount: remainingCreditableDec.toNumber(),
    items,
  };
}

/**
 * Obtiene las facturas emitidas y acreditables de un cliente para emitir Notas de Crédito.
 */
export async function getEligibleOrdersForPersona(
  personaId: number,
  rawQuery?: string,
): Promise<EligibleOrderForCreditNote[]> {
  if (!Number.isInteger(personaId) || personaId <= 0) {
    throw new AppError('ID de cliente inválido.', 400);
  }

  const persona = await prisma.persona.findUnique({
    where: { id: personaId },
    select: { id: true },
  });
  if (!persona) {
    throw new AppError('El cliente seleccionado no existe.', 404);
  }

  const q = typeof rawQuery === 'string' ? rawQuery.trim() : '';

  const orders = await prisma.order.findMany({
    where: {
      personaId,
      status: { not: OrderStatus.CANCELLED },
      AND: [
        {
          OR: [
            { billingType: BillingType.OFFICIAL, cae: { not: null } },
            {
              billingType: BillingType.INTERNAL,
              OR: [{ invoiceNumber: { not: null } }, { invoicedAt: { not: null } }],
            },
          ],
        },
        ...(q
          ? [
              {
                OR: [
                  { invoiceNumber: { contains: q, mode: 'insensitive' as const } },
                  ...(Number.isInteger(Number(q)) && Number(q) > 0 ? [{ id: Number(q) }] : []),
                ],
              },
            ]
          : []),
      ],
    },
    include: {
      items: {
        include: {
          product: {
            select: {
              id: true,
              name: true,
              sku: true,
              isPesable: true,
              approximateWeight: true,
            },
          },
        },
      },
    },
    orderBy: [{ invoicedAt: 'desc' }, { createdAt: 'desc' }],
    take: 80,
  });

  if (orders.length === 0) return [];

  const orderIds = orders.map((o) => o.id);
  const existingNotes = await prisma.creditNote.findMany({
    where: {
      orderId: { in: orderIds },
      status: { in: [CreditNoteStatus.APPROVED, CreditNoteStatus.PENDING_APPROVAL] },
    },
    include: { items: true },
  });

  const notesByOrderId = new Map<number, any[]>();
  for (const note of existingNotes) {
    if (!note.orderId) continue;
    const list = notesByOrderId.get(note.orderId) ?? [];
    list.push(note);
    notesByOrderId.set(note.orderId, list);
  }

  const eligible: EligibleOrderForCreditNote[] = [];
  for (const order of orders) {
    const summary = computeEligibleOrderSummary(order, notesByOrderId.get(order.id) ?? []);
    if (summary) {
      eligible.push(summary);
    }
  }

  return eligible;
}
