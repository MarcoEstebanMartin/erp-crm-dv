import AppError from '../../utils/AppError';
import { roundToTwoDecimals, toDecimal } from '../../core/money';
import { extractBaseLotNumber, normalizeWmsLocationCode } from '../../engines/stock.engine';
import { lockProductsForUpdate } from '../../utils/db-locks.util';
import { assertSlotAcceptsStockInTx } from '../../utils/warehouse-base-layout.util';

export const DEFAULT_SENTINEL_EXPIRATION = new Date('2036-12-31T00:00:00Z');

export interface CleanPurchaseLotInput {
  lotNumber?: string | null;
  expirationDate?: string | null;
  location?: string | null;
}

export interface PurchaseStockItemInput extends CleanPurchaseLotInput {
  productId: number;
  quantity: number;
  unitCost?: number;
}

/**
 * Normaliza lote, vencimiento centinela y ubicación WMS evitando prefijos basura.
 */
export function resolveCleanPurchaseLot(assignment?: CleanPurchaseLotInput | null) {
  const rawLot = assignment?.lotNumber ? String(assignment.lotNumber).trim() : '';
  const lotNumber = !rawLot || rawLot.toUpperCase() === 'S/L' ? 'S/L' : extractBaseLotNumber(rawLot);
  let expirationDate = DEFAULT_SENTINEL_EXPIRATION;
  if (assignment?.expirationDate && String(assignment.expirationDate).trim()) {
    const parsed = new Date(String(assignment.expirationDate).trim());
    if (!Number.isNaN(parsed.getTime())) expirationDate = parsed;
  }
  const location = normalizeWmsLocationCode(assignment?.location ? String(assignment.location) : 'S/U');
  return { lotNumber, expirationDate, location };
}

/**
 * Ingresa mercadería de compras de forma atómica con bloqueo FOR UPDATE, lote único y Kardex IN.
 */
export async function applyPurchaseStockInTx(
  tx: any,
  params: { userId: number; purchaseOrderId: number; supplierInvoiceId?: number | null; reason: string; items: PurchaseStockItemInput[] },
) {
  const validItems = (params.items || []).filter((item) => Number(item.productId) > 0 && Math.trunc(Number(item.quantity)) > 0);
  if (validItems.length === 0) return [];

  if (typeof tx?.$queryRaw === 'function') {
    await lockProductsForUpdate(tx, validItems.map((i) => Number(i.productId)));
  }

  const applied = [];
  const referenceId = params.supplierInvoiceId ? `INV-${params.supplierInvoiceId}` : `PO-${params.purchaseOrderId}`;

  for (const item of validItems) {
    const productId = Number(item.productId);
    const qty = Math.trunc(Number(item.quantity));
    const unitCost = item.unitCost !== undefined && Number(item.unitCost) > 0 ? roundToTwoDecimals(item.unitCost).toNumber() : undefined;

    await tx.product.update({
      where: { id: productId },
      data: { stock: { increment: qty }, ...(unitCost !== undefined ? { costPrice: unitCost } : {}) },
    });

    const { lotNumber, expirationDate, location } = resolveCleanPurchaseLot(item);
    if (location !== 'S/U') {
      await assertSlotAcceptsStockInTx(tx, location);
    }
    let lot = await tx.productLot.findUnique({ where: { productId_lotNumber_location: { productId, lotNumber, location } } });
    lot = lot
      ? await tx.productLot.update({ where: { id: lot.id }, data: { stock: { increment: qty } } })
      : await tx.productLot.create({ data: { productId, lotNumber, expirationDate, stock: qty, location } });

    await tx.stockMovement.create({
      data: {
        productId, quantity: qty, type: 'IN', purchaseOrderId: params.purchaseOrderId,
        referenceId, userId: params.userId, reason: params.reason, productLotId: lot.id,
      },
    });
    applied.push({ productId, quantity: qty, productLotId: lot.id, lotNumber, location });
  }
  return applied;
}

/**
 * Crea la recepción (PurchaseOrder PENDING en tránsito o RECEIVED inmediata) vinculada a una factura.
 */
export async function createLinkedPurchaseReceptionInTx(
  tx: any,
  params: {
    userId: number;
    personaId: number;
    supplierInvoiceId: number | null;
    mode: 'IN_TRANSIT' | 'IMMEDIATE';
    reason: string;
    fallbackTotal?: number;
    items: PurchaseStockItemInput[];
  },
) {
  const poItems = params.items.map((item) => {
    const qty = Math.trunc(Number(item.quantity));
    const costDec = roundToTwoDecimals(item.unitCost || 0);
    return { productId: Number(item.productId), quantity: qty, costPrice: costDec.toNumber(), subtotal: roundToTwoDecimals(costDec.times(qty)).toNumber() };
  });
  const itemsNetSum = poItems.reduce((acc, it) => acc.plus(toDecimal(it.subtotal)), toDecimal(0));
  const totalAmount = poItems.length > 0 ? roundToTwoDecimals(itemsNetSum).toNumber() : roundToTwoDecimals(params.fallbackTotal ?? 0).toNumber();

  const po = await tx.purchaseOrder.create({
    data: {
      personaId: params.personaId,
      supplierInvoiceId: params.supplierInvoiceId,
      status: params.mode === 'IN_TRANSIT' ? 'PENDING' : 'RECEIVED',
      receivedAt: params.mode === 'IN_TRANSIT' ? null : new Date(),
      totalAmount,
      items: { create: poItems },
    },
  });

  if (params.mode === 'IMMEDIATE') {
    await applyPurchaseStockInTx(tx, {
      userId: params.userId,
      purchaseOrderId: po.id,
      supplierInvoiceId: params.supplierInvoiceId,
      reason: params.reason,
      items: params.items,
    });
  }
  return po;
}

/**
 * Revierte de forma segura las recepciones y movimientos de stock asociados a una factura anulada.
 */
export async function revertSupplierInvoiceStockInTx(
  tx: any,
  params: { invoiceId: number; invoiceNumber: string; userId?: number },
) {
  if (tx.purchaseOrder?.deleteMany) {
    await tx.purchaseOrder.deleteMany({ where: { supplierInvoiceId: params.invoiceId, status: 'PENDING' } });
  }

  const stockMovements = await tx.stockMovement.findMany({ where: { referenceId: `INV-${params.invoiceId}` } });
  for (const movement of stockMovements) {
    const targetLot = movement.productLotId
      ? await tx.productLot.findUnique({ where: { id: movement.productLotId } })
      : await tx.productLot.findFirst({ where: { productId: movement.productId, lotNumber: params.invoiceNumber } });

    if (targetLot && targetLot.stock !== undefined && Number(targetLot.stock) < Number(movement.quantity)) {
      throw new AppError('No se puede anular la factura porque parte de la mercadería ingresada ya fue vendida o reubicada.', 400);
    }

    await tx.product.update({ where: { id: movement.productId }, data: { stock: { decrement: movement.quantity } } });
    if (targetLot) {
      await tx.productLot.update({ where: { id: targetLot.id }, data: { stock: { decrement: movement.quantity } } });
    }

    if (typeof tx.stockMovement.create === 'function') {
      await tx.stockMovement.create({
        data: {
          productId: movement.productId, quantity: -movement.quantity, type: 'ADJUSTMENT',
          referenceId: `VOID-INV-${params.invoiceId}`, userId: params.userId ?? movement.userId,
          reason: `Anulación Factura Compra ${params.invoiceNumber}`, productLotId: targetLot?.id ?? movement.productLotId ?? null,
        },
      });
      if (typeof tx.stockMovement.update === 'function') {
        await tx.stockMovement.update({ where: { id: movement.id }, data: { referenceId: `VOIDED-INV-${params.invoiceId}` } });
      }
    } else {
      await tx.stockMovement.delete({ where: { id: movement.id } });
    }
  }

  if (tx.purchaseOrder?.updateMany) {
    await tx.purchaseOrder.updateMany({ where: { supplierInvoiceId: params.invoiceId, status: 'RECEIVED' }, data: { status: 'CANCELLED', supplierInvoiceId: null } });
  }
}
