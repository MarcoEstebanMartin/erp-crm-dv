import type { EligibleOrderForCreditNote } from '../../../api/billing.api';
import { calculateExactLineSubtotalInt } from '../../../utils/weeklyPromoCartEvaluator';

export interface CreditNoteCartItem {
  productId: number;
  name: string;
  sku: string;
  selected: boolean;
  quantity: number;
  weight: number | null;
  isPesable: boolean;
  approximateWeight: number | null;
  unitPrice: number;
  subtotal: number;
  orderQuantity?: number;
  alreadyReturnedQuantity?: number;
  remainingReturnableQuantity?: number;
  orderWeight?: number | null;
}

/**
 * Convierte una factura elegible en filas listas para el carrito de Nota de Crédito,
 * respetando cantidades pendientes de devolución y cálculo entero exacto.
 */
export function buildCartItemsFromEligibleOrder(
  order: EligibleOrderForCreditNote,
): CreditNoteCartItem[] {
  return (order.items || []).map((item) => {
    const maxQty = Math.max(0, Number(item.remainingReturnableQuantity ?? item.orderQuantity ?? 0));
    const orderQty = Number(item.orderQuantity || 0);
    const ratio = orderQty > 0 ? maxQty / orderQty : 0;

    let maxWeight: number | null = null;
    if (item.isPesable) {
      const origWeight =
        item.orderWeight !== null && item.orderWeight !== undefined
          ? Number(item.orderWeight)
          : orderQty * Number(item.approximateWeight || 1);
      maxWeight = Number((origWeight * ratio).toFixed(3));
    }

    const unitPrice = Number(item.unitPrice || 0);
    const subtotal =
      maxQty > 0
        ? calculateExactLineSubtotalInt({
            unitPriceInt: unitPrice,
            quantity: maxQty,
            isPesable: Boolean(item.isPesable),
            weight: maxWeight,
            approximateWeight: item.approximateWeight,
          })
        : 0;

    return {
      productId: item.productId,
      name: item.name,
      sku: item.sku || '',
      selected: maxQty > 0,
      quantity: maxQty,
      weight: maxWeight,
      isPesable: Boolean(item.isPesable),
      approximateWeight: item.approximateWeight ?? 1,
      unitPrice,
      subtotal,
      orderQuantity: orderQty,
      alreadyReturnedQuantity: Number(item.alreadyReturnedQuantity || 0),
      remainingReturnableQuantity: maxQty,
      orderWeight: maxWeight,
    };
  });
}

/**
 * Suma entera de los ítems activos del carrito de Nota de Crédito.
 */
export function computeCreditNoteCartTotal(cart: CreditNoteCartItem[]): number {
  return cart.reduce((sum, item) => {
    if (item.selected === false) return sum;
    return sum + Math.round(Number(item.subtotal || 0));
  }, 0);
}

/**
 * Etiqueta corta de comprobante para selector y encabezado del modal.
 */
export function formatInvoiceShortCode(order: {
  id: number;
  invoiceNumber?: string | null;
  invoiceType?: string | null;
  billingType?: string | null;
}): string {
  const num = order.invoiceNumber?.trim();
  const type = String(order.invoiceType || '');
  if (order.billingType === 'OFFICIAL') {
    const prefix = type === 'FACTURA_A' ? 'FA' : type === 'FACTURA_B' ? 'FB' : 'FC';
    return num ? `${prefix} ${num}` : `${prefix} #${order.id}`;
  }
  if (!num) return `INT #${order.id}`;
  return /^INT\b/i.test(num) ? num : `INT ${num}`;
}
