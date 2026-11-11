import { BillingType, InvoiceType, OrderStatus, PaymentMethod, Prisma } from '@prisma/client';
import { recordInvoicePerceptions, settleOrderFinancials } from './order-tax.helpers';
import { reassignSplitStockMovements } from './order-billing.helpers';

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
    taxInfo: { percepIIBB: number; percepIVA: number };
    activeDrawerId?: number;
    selectedBankId?: number;
  },
): Promise<{ split: boolean; internalOrderId: number | null; internalOrderTotal: number }> {
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
    taxInfo,
    activeDrawerId,
    selectedBankId,
  } = params;

  let internalOrderId: number | null = null;

  if (splitApplied) {
    const internalOrder = await tx.order.create({
      data: {
        personaId: order.personaId,
        sellerId: order.sellerId,
        billingType: BillingType.INTERNAL,
        invoiceType: InvoiceType.PRESUPUESTO,
        invoiceNumber: `INT-${order.id.toString().padStart(5, '0')}-X`,
        totalAmount: internalOrderTotal,
        status: OrderStatus.DELIVERED,
      },
    });
    internalOrderId = internalOrder.id;

    for (const item of internoItemsData) {
      await tx.orderItem.create({
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

    await reassignSplitStockMovements(
      tx,
      order.id,
      internalOrder.id,
      order.sellerId,
      internoItemsData,
    );
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
    isFacturaAOfficial: true,
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

  return { split: splitApplied, internalOrderId, internalOrderTotal };
}
