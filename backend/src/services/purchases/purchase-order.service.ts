import { BillingType, LedgerEntryType, LedgerSourceType } from '@prisma/client';
import prisma from '../../utils/prisma';
import AppError from '../../utils/AppError';
import { logAudit } from '../../utils/audit';
import { calculateAfipBreakdown, roundToTwoDecimals } from '../../core/money';
import { calculatePurchaseOrderTotals } from '../../engines/credit-purchase.engine';
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
        items: { include: { product: true } },
      },
      orderBy: { createdAt: 'desc' },
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
    lotAssignments?: Record<string, any> | null;
    billingType?: string;
  }) {
    const result = await prisma.$transaction(async (tx) => {
      const order = await tx.purchaseOrder.findUnique({
        where: { id: params.orderId },
        include: { items: true },
      });

      if (!order) throw new AppError('Orden de compra no encontrada.', 404);
      if (order.status !== 'PENDING') {
        throw new AppError('Esta orden de compra ya fue procesada o cancelada.', 400);
      }

      const updatedOrder = await tx.purchaseOrder.update({
        where: { id: order.id },
        data: { status: 'RECEIVED' },
      });

      for (const item of order.items) {
        const qty = Number(item.quantity);
        const cost = roundToTwoDecimals(item.costPrice.toString()).toNumber();

        const product = await tx.product.findUnique({ where: { id: item.productId } });
        if (product) {
          await tx.product.update({
            where: { id: product.id },
            data: { stock: { increment: qty }, costPrice: cost },
          });
        }

        const assignment = params.lotAssignments ? params.lotAssignments[item.productId] : null;
        const lotNumber = assignment?.lotNumber ? String(assignment.lotNumber) : 'S/L';
        const expirationDate = assignment?.expirationDate
          ? new Date(assignment.expirationDate)
          : new Date('2036-12-31T00:00:00Z');
        const location = assignment?.location ? String(assignment.location) : 'S/U';

        let lot = await tx.productLot.findUnique({
          where: { productId_lotNumber: { productId: item.productId, lotNumber } },
        });

        if (lot) {
          lot = await tx.productLot.update({
            where: { id: lot.id },
            data: {
              stock: { increment: qty },
              location: location !== 'S/U' ? location : lot.location,
            },
          });
        } else {
          lot = await tx.productLot.create({
            data: {
              productId: item.productId,
              lotNumber,
              expirationDate,
              stock: qty,
              location,
            },
          });
        }

        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            quantity: qty,
            type: 'IN',
            purchaseOrderId: order.id,
            referenceId: `PO-${order.id}`,
            userId: params.userId,
            reason: 'Recepción de Orden de Compra',
            productLotId: lot.id,
          },
        });
      }

      const breakdown = calculateAfipBreakdown(order.totalAmount.toString(), 21, 0);
      const total = breakdown.totalAmount.toNumber();
      const nroInvoice = params.invoiceNumber || `COMP-${order.id.toString().padStart(5, '0')}`;

      const resolvedBillingType =
        params.billingType === BillingType.INTERNAL ? BillingType.INTERNAL : BillingType.OFFICIAL;

      const createdInv = await tx.supplierInvoice.create({
        data: {
          personaId: order.personaId,
          invoiceNumber: nroInvoice,
          invoiceType: 'FACTURA_A',
          issueDate: new Date(),
          dueDate: new Date(Date.now() + 30 * 24 * 3600 * 1000),
          status: 'PENDING',
          paidAmount: 0,
          netAmount: breakdown.netAmount.toNumber(),
          taxAmount: breakdown.ivaAmount.toNumber(),
          percepcionAmount: 0,
          totalAmount: total,
          billingType: resolvedBillingType,
        },
      });

      await recordLedgerMovement(tx, {
        personaId: order.personaId,
        entryType: LedgerEntryType.CREDIT,
        sourceType: LedgerSourceType.SUPPLIER_INVOICE,
        billingType: resolvedBillingType,
        amount: total,
        supplierInvoiceId: createdInv.id,
        purchaseOrderId: order.id,
        userId: params.userId,
        reference: `Factura Nro ${nroInvoice}`,
        description: `Compra - Recepción OC #${order.id} (${nroInvoice})`,
      });

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
