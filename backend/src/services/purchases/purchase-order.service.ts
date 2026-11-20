import { BillingType, LedgerEntryType, LedgerSourceType } from '@prisma/client';
import prisma from '../../utils/prisma';
import AppError from '../../utils/AppError';
import { logAudit } from '../../utils/audit';
import { roundToTwoDecimals, toDecimal } from '../../core/money';
import { calculatePurchaseOrderTotals } from '../../engines/credit-purchase.engine';
import { applyPurchaseStockInTx } from './purchase-stock-tx.helper';
import { recordLedgerMovement } from '../ledger/account-ledger.service';

export const purchaseOrderService = {
  async getPurchaseOrders(query: { startDate?: string; endDate?: string; status?: string }) {
    const whereClause: Record<string, any> = {};

    if (query.startDate && query.endDate) {
      whereClause.createdAt = {
        gte: new Date(String(query.startDate)),
        lte: new Date(String(query.endDate)),
      };
    }
    if (query.status) {
      whereClause.status = String(query.status);
    }

    return prisma.purchaseOrder.findMany({
      where: whereClause,
      include: {
        persona: true,
        supplierInvoice: true,
        items: { include: { product: true } },
        stockMovements: { include: { productLot: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: query.startDate && query.endDate ? 500 : 200,
    });
  },

  async createPurchaseOrder(params: {
    userId?: number;
    personaId: number;
    items: Array<{ productId: number; quantity: number; costPrice: number }>;
  }) {
    const provider = await prisma.persona.findUnique({ where: { id: Number(params.personaId) } });
    if (!provider) {
      throw new AppError('Proveedor no encontrado.', 404);
    }

    const { parsedItems, totalAmount } = calculatePurchaseOrderTotals(params.items);

    const order = await prisma.$transaction(async (tx) => {
      return tx.purchaseOrder.create({
        data: {
          personaId: provider.id,
          status: 'PENDING',
          totalAmount,
          items: { create: parsedItems },
        },
        include: { items: true },
      });
    });

    if (params.userId) {
      await logAudit({
        userId: params.userId,
        action: 'CREATE_PURCHASE_ORDER',
        entityType: 'PurchaseOrder',
        entityId: order.id,
        newValues: order,
      });
    }

    return order;
  },

  async receivePurchaseOrder(params: {
    userId: number;
    orderId: number;
    invoiceNumber?: string | null;
    invoiceType?: string;
    lotAssignments?: Record<string, any> | null;
    receivedQuantities?: Record<string, number> | null;
    billingType?: string;
  }) {
    const result = await prisma.$transaction(async (tx) => {
      if (typeof tx.$queryRaw === 'function') {
        await tx.$queryRaw`SELECT id FROM "PurchaseOrder" WHERE id = ${params.orderId} FOR UPDATE`;
      }

      const order = await tx.purchaseOrder.findUnique({
        where: { id: params.orderId },
        include: { items: true, supplierInvoice: true },
      });

      if (!order) throw new AppError('Orden de compra no encontrada.', 404);
      if (order.status !== 'PENDING') {
        throw new AppError('Esta recepción ya fue procesada o cancelada.', 400);
      }

      const now = new Date();
      let effectiveOrderTotalDec = toDecimal(0);
      const effectiveItems = [];

      for (const item of order.items) {
        const overrideRaw =
          params.receivedQuantities?.[item.productId] ??
          params.receivedQuantities?.[String(item.productId)];
        const qty =
          overrideRaw !== undefined && overrideRaw !== null
            ? Math.max(0, Math.trunc(Number(overrideRaw)))
            : Number(item.quantity);
        const costDec = roundToTwoDecimals(item.costPrice.toString());
        const subDec = roundToTwoDecimals(costDec.times(qty));
        effectiveOrderTotalDec = effectiveOrderTotalDec.plus(subDec);

        if (qty !== Number(item.quantity) && tx.purchaseOrderItem?.update) {
          await tx.purchaseOrderItem.update({
            where: { id: item.id },
            data: { quantity: qty, subtotal: subDec.toNumber() },
          });
        }

        effectiveItems.push({
          productId: item.productId,
          quantity: qty,
          costPrice: costDec.toNumber(),
        });
      }

      const finalOrderTotal =
        order.items.length > 0
          ? roundToTwoDecimals(effectiveOrderTotalDec).toNumber()
          : roundToTwoDecimals(order.totalAmount.toString()).toNumber();

      let updatedOrder = await tx.purchaseOrder.update({
        where: { id: order.id },
        data: { status: 'RECEIVED', receivedAt: now, totalAmount: finalOrderTotal },
      });

      await applyPurchaseStockInTx(tx, {
        userId: params.userId,
        purchaseOrderId: order.id,
        supplierInvoiceId: order.supplierInvoiceId,
        reason: order.supplierInvoiceId
          ? `Recepción Factura ${order.supplierInvoice?.invoiceNumber || `#${order.supplierInvoiceId}`}`
          : 'Recepción de Mercadería',
        items: effectiveItems.map((item) => {
          const assignment = params.lotAssignments
            ? params.lotAssignments[item.productId] || params.lotAssignments[String(item.productId)]
            : null;
          return {
            productId: item.productId,
            quantity: item.quantity,
            unitCost: item.costPrice,
            lotNumber: assignment?.lotNumber,
            expirationDate: assignment?.expirationDate,
            location: assignment?.location,
          };
        }),
      });

      if (order.supplierInvoiceId) {
        await tx.supplierInvoice.update({
          where: { id: order.supplierInvoiceId },
          data: { receptionStatus: 'RECEIVED', receivedAt: now },
        });
      } else {
        const resolvedBillingType =
          params.billingType === BillingType.OFFICIAL ? BillingType.OFFICIAL : BillingType.INTERNAL;
        const resolvedInvoiceType =
          params.invoiceType?.trim() ||
          (resolvedBillingType === BillingType.OFFICIAL ? 'FACTURA_A' : 'REMITO_X');
        const netDec = roundToTwoDecimals(finalOrderTotal);
        const applyIva =
          resolvedBillingType === BillingType.OFFICIAL && resolvedInvoiceType === 'FACTURA_A';
        const taxDec = applyIva ? roundToTwoDecimals(netDec.times('0.21')) : toDecimal(0);
        const totalDec = roundToTwoDecimals(netDec.plus(taxDec));
        const nroInvoice =
          params.invoiceNumber?.trim() || `COMP-${order.id.toString().padStart(5, '0')}`;

        const createdInv = await tx.supplierInvoice.create({
          data: {
            personaId: order.personaId,
            invoiceNumber: nroInvoice,
            invoiceType: resolvedInvoiceType,
            issueDate: now,
            dueDate: new Date(now.getTime() + 30 * 24 * 3600 * 1000),
            status: 'PENDING',
            paidAmount: 0,
            netAmount: netDec.toNumber(),
            taxAmount: taxDec.toNumber(),
            percepcionAmount: 0,
            totalAmount: totalDec.toNumber(),
            billingType: resolvedBillingType,
            receptionStatus: 'RECEIVED',
            receivedAt: now,
          },
        });

        updatedOrder = await tx.purchaseOrder.update({
          where: { id: order.id },
          data: { supplierInvoiceId: createdInv.id },
        });

        await recordLedgerMovement(tx, {
          personaId: order.personaId,
          entryType: LedgerEntryType.CREDIT,
          sourceType: LedgerSourceType.SUPPLIER_INVOICE,
          billingType: resolvedBillingType,
          amount: totalDec.toNumber(),
          supplierInvoiceId: createdInv.id,
          purchaseOrderId: order.id,
          userId: params.userId,
          reference: `Factura Nro ${nroInvoice}`,
          description: `Compra - Recepción #${order.id} (${nroInvoice})`,
        });
      }

      return updatedOrder;
    });

    await logAudit({
      userId: params.userId,
      action: 'RECEIVE_PURCHASE_ORDER',
      entityType: 'PurchaseOrder',
      entityId: result.id,
      newValues: result,
    });

    return result;
  },
};
