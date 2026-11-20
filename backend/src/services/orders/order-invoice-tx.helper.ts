import { BillingType, DeliveryMethod, InvoiceType, OrderStatus, PaymentMethod, Prisma } from '@prisma/client';
import { roundToIntegerPeso, roundToTwoDecimals } from '../../core/money';
import { recordInvoicePerceptions, settleOrderFinancials } from './order-tax.helpers';
import { reassignSplitStockMovements } from './order-billing.helpers';
import { ensureFefoLotsForOrderItem } from './order-lot-picking.helper';
import { lockProductsForUpdate } from '../../utils/db-locks.util';

async function transferSplitOrderItemLotsInTx(
  tx: any,
  sourceOrderItemId: number | undefined,
  targetOrderItemId: number,
  qtyToMove: number,
): Promise<void> {
  if (!sourceOrderItemId || qtyToMove <= 0 || typeof tx.orderItemLot?.findMany !== 'function') {
    return;
  }

  const sourceLinks = await tx.orderItemLot.findMany({
    where: { orderItemId: sourceOrderItemId },
    orderBy: { id: 'asc' },
  });

  let remaining = qtyToMove;
  for (const link of sourceLinks || []) {
    if (remaining <= 0) break;
    const moveQty = Math.min(Number(link.quantity || 0), remaining);
    if (moveQty <= 0) continue;

    await tx.orderItemLot.create({
      data: { orderItemId: targetOrderItemId, productLotId: link.productLotId, quantity: moveQty },
    });

    const leftover = Number(link.quantity || 0) - moveQty;
    if (leftover <= 0) {
      await tx.orderItemLot.delete({ where: { id: link.id } });
    } else {
      await tx.orderItemLot.update({ where: { id: link.id }, data: { quantity: leftover } });
    }
    remaining -= moveQty;
  }
}

export async function executeInvoiceOrderSettlementTx(
  tx: Prisma.TransactionClient,
  params: {
    order: any;
    adminId: number;
    billingType: BillingType;
    paymentMethod?: PaymentMethod;
    paymentDescription?: string;
    splitApplied: boolean;
    hasSplit: boolean;
    internoItemsData: any[];
    oficialItemsData: any[];
    internalOrderTotal: number;
    officialOrderTotal: number;
    finalInvoiceNumber: string | null;
    finalCae: string | null;
    finalCaeDueDate: Date | null;
    taxInfo: {
      net: number;
      tax: number;
      percepIIBB: number;
      percepIVA: number;
      finalInvoiceType: InvoiceType;
      isFacturaAOfficial: boolean;
    };
    activeDrawerId?: number;
    selectedBankId?: number;
    deliveryMethod?: DeliveryMethod;
    markPickedUp?: boolean;
  },
): Promise<{ updatedOrder: any; split: boolean; internalOrderId: number | null; internalOrderTotal: number }> {
  const {
    order,
    adminId,
    billingType,
    paymentMethod,
    paymentDescription,
    splitApplied,
    hasSplit,
    internoItemsData,
    oficialItemsData,
    internalOrderTotal,
    officialOrderTotal,
    finalInvoiceNumber,
    finalCae,
    finalCaeDueDate,
    taxInfo,
    activeDrawerId,
    selectedBankId,
  } = params;

  if (typeof (tx as any).$queryRaw === 'function') {
    await (tx as any).$queryRaw(Prisma.sql`SELECT id FROM "Order" WHERE id = ${order.id} FOR UPDATE`);
  }

  const currentInTx =
    typeof tx.order?.findUnique === 'function'
      ? await tx.order.findUnique({ where: { id: order.id }, select: { status: true } })
      : null;
  const effectiveStatus = currentInTx?.status ?? order.status;
  if (effectiveStatus !== OrderStatus.PREPARED) {
    throw new Error(`El pedido #${order.id} ya fue facturado o cambió de estado (${effectiveStatus}).`);
  }

  const unallocatedProductIds = (order.items || [])
    .filter((origItem: any) => Array.isArray(origItem.orderItemLots) && origItem.orderItemLots.length === 0 && origItem.quantity > 0)
    .map((origItem: any) => origItem.productId);
  if (unallocatedProductIds.length > 0) {
    await lockProductsForUpdate(tx, unallocatedProductIds);
  }

  for (const origItem of order.items || []) {
    if (Array.isArray(origItem.orderItemLots) && origItem.orderItemLots.length === 0 && origItem.quantity > 0) {
      await ensureFefoLotsForOrderItem(tx, {
        orderId: order.id,
        orderItemId: origItem.id,
        productId: origItem.productId,
        quantity: origItem.quantity,
        sellerId: order.sellerId,
      });
    }
  }

  let internalOrderId: number | null = null;
  const invoicedAt = new Date();
  const effectiveDeliveryMethod: DeliveryMethod =
    params.deliveryMethod ?? (order.deliveryMethod as DeliveryMethod) ?? DeliveryMethod.DELIVERY;
  const isPickup = effectiveDeliveryMethod === DeliveryMethod.PICKUP;
  const nextDeliveredAt = isPickup
    ? params.markPickedUp === false
      ? null
      : params.markPickedUp === true
        ? new Date()
        : order.deliveredAt ?? null
    : params.deliveryMethod === DeliveryMethod.DELIVERY
      ? null
      : undefined;

  if (splitApplied) {
    const internalOrder = await tx.order.create({
      data: {
        personaId: order.personaId,
        sellerId: order.sellerId,
        billingType: BillingType.INTERNAL,
        invoiceType: InvoiceType.PRESUPUESTO,
        invoiceNumber: `INT-${order.id.toString().padStart(5, '0')}-X`,
        invoicedAt,
        totalAmount: internalOrderTotal,
        status: OrderStatus.DELIVERED,
        deliveryMethod: effectiveDeliveryMethod,
        deliveryRouteId: isPickup ? null : order.deliveryRouteId ?? null,
        deliverySequence: isPickup ? null : order.deliverySequence ?? null,
        deliveredAt: nextDeliveredAt ?? order.deliveredAt ?? null,
      },
    });
    internalOrderId = internalOrder.id;

    for (const item of internoItemsData) {
      const createdInternalItem = await tx.orderItem.create({
        data: {
          orderId: internalOrder.id,
          productId: item.productId,
          quantity: item.quantity,
          weight: item.weight,
          unitPrice: item.unitPrice,
          subtotal: item.subtotal,
          unitCostSnapshot: item.unitCostSnapshot,
          listPriceSnapshot: item.listPriceSnapshot,
          discountPctSnapshot: item.discountPctSnapshot,
        },
      });
      await transferSplitOrderItemLotsInTx(
        tx,
        item.sourceOrderItemId ?? item.orderItemId,
        createdInternalItem.id,
        item.quantity,
      );
    }

    await settleOrderFinancials(tx, {
      orderId: internalOrder.id,
      personaId: order.personaId,
      adminId,
      billingType: BillingType.INTERNAL,
      paymentMethod,
      amount: internalOrderTotal,
      invoiceTotal: internalOrderTotal,
      invoiceNumber: `INT-${order.id.toString().padStart(5, '0')}-X`,
      description: `Cobro en caja de pedido interno #${internalOrder.id} (Parte Interna de Pedido Original #${order.id})`,
      cashDrawerId: activeDrawerId,
      bankAccountId: selectedBankId,
    });

    await reassignSplitStockMovements(tx, order.id, internalOrder.id, order.sellerId, internoItemsData);
  }

  for (const item of oficialItemsData) {
    if (item.orderItemId) {
      await tx.orderItem.update({
        where: { id: item.orderItemId },
        data: {
          quantity: item.quantity,
          weight: item.weight,
          unitPrice: item.unitPrice,
          subtotal: item.subtotal,
          unitCostSnapshot: item.unitCostSnapshot,
          listPriceSnapshot: item.listPriceSnapshot,
          discountPctSnapshot: item.discountPctSnapshot,
        },
      });
    }
  }

  if (hasSplit) {
    const oficialItemsIds = oficialItemsData
      .map((o) => o.orderItemId)
      .filter((id) => id !== undefined);
    await tx.orderItem.deleteMany({
      where: { orderId: order.id, id: { notIn: oficialItemsIds } },
    });
  }

  await recordInvoicePerceptions(tx, {
    personaId: order.personaId,
    invoiceNumber: finalInvoiceNumber || `FAC-${order.id}`,
    percepIIBB: taxInfo.percepIIBB,
    percepIVA: taxInfo.percepIVA,
    isFacturaAOfficial: taxInfo.isFacturaAOfficial,
    provinceOrAddress: order.persona.province || order.persona.address,
  });

  await settleOrderFinancials(tx, {
    orderId: order.id,
    personaId: order.personaId,
    adminId,
    billingType,
    paymentMethod,
    amount: officialOrderTotal,
    invoiceTotal: officialOrderTotal,
    invoiceNumber: finalInvoiceNumber,
    description: paymentDescription
      ? `Cobro en caja de pedido #${order.id} - ${paymentDescription}`
      : `Cobro en caja de pedido #${order.id} (Parte Oficial)`,
    cashDrawerId: activeDrawerId,
    bankAccountId: selectedBankId,
  });

  const roundFiscal = (v: number) =>
    taxInfo.isFacturaAOfficial ? roundToTwoDecimals(v).toNumber() : roundToIntegerPeso(v).toNumber();

  const updatedOrder = await tx.order.update({
    where: { id: order.id },
    data: {
      billingType,
      invoiceType: taxInfo.finalInvoiceType,
      invoiceNumber: finalInvoiceNumber,
      invoicedAt,
      cae: finalCae,
      caeDueDate: finalCaeDueDate ? new Date(finalCaeDueDate) : null,
      totalAmount: officialOrderTotal,
      netAmount: roundFiscal(taxInfo.net),
      taxAmount: roundFiscal(taxInfo.tax),
      percepcionAmount: roundFiscal(taxInfo.percepIIBB),
      percepcionIvaAmount: roundFiscal(taxInfo.percepIVA),
      status: OrderStatus.DELIVERED,
      ...(params.deliveryMethod !== undefined
        ? {
            deliveryMethod: effectiveDeliveryMethod,
            ...(isPickup ? { deliveryRouteId: null, deliverySequence: null } : {}),
          }
        : {}),
      ...(nextDeliveredAt !== undefined ? { deliveredAt: nextDeliveredAt } : {}),
    },
    include: { items: { include: { product: true, orderItemLots: true } }, persona: true },
  });

  return { updatedOrder, split: splitApplied, internalOrderId, internalOrderTotal };
}
