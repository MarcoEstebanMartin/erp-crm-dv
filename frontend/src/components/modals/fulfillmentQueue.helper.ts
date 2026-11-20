import { BillingType } from '../../utils/types';
import { toOrderIntegerPesosBigInt } from '../../utils/fulfillmentCardMeta.helper';
import { isBonusOrderItem } from '../../utils/weeklyPromoCartEvaluator';
import {
  buildInitialFulfillmentWeights,
  detectFulfillmentWeightAnomalies,
  isOrderItemWeighable,
} from './orderFulfillmentMath';

export type BatchInvoiceStatus = 'INVOICED' | 'ERROR';

export interface BatchInvoiceResult {
  orderId: number;
  clientName: string;
  status: BatchInvoiceStatus;
  billingType?: BillingType;
  invoiceNumber?: string | null;
  totalAmount?: number;
  errorMessage?: string;
}

export interface BatchInvoiceSummary {
  invoicedCount: number;
  errorCount: number;
  invoicedTotalPesos: bigint;
}

/**
 * Resuelve qué pedidos entran al lote de facturación:
 * si hay pedidos marcados manualmente, usa esos en el orden visible;
 * si no hay marcados, toma todos los pedidos visibles en "En Armado".
 */
export function resolvePreparingQueueOrders<T extends { id: number }>(
  preparingOrders: T[],
  selectedPreparingIds: number[],
): T[] {
  if (selectedPreparingIds.length === 0) {
    return [...preparingOrders];
  }
  const selectedSet = new Set(selectedPreparingIds);
  const matched = preparingOrders.filter((o) => selectedSet.has(o.id));
  return matched.length > 0 ? matched : [...preparingOrders];
}

/**
 * Construye los pesos reales a confirmar para un pedido en facturación por lote.
 */
export function buildBatchOrderWeightItems(order: any): Array<{ orderItemId: number; weight: number }> {
  const weights = buildInitialFulfillmentWeights(order?.items);
  const weighableIds = new Set<number>(
    (order?.items || [])
      .filter((item: any) => isOrderItemWeighable(item) && !isBonusOrderItem(item))
      .map((item: any) => Number(item.id)),
  );
  return Object.entries(weights)
    .filter(([id, w]) => weighableIds.has(Number(id)) && Number(w) > 0)
    .map(([id, w]) => ({ orderItemId: Number(id), weight: Number(w) }));
}

/**
 * Indica si un pedido tiene algún pesable con anomalía de peso respecto al promedio esperado.
 */
export function hasBatchOrderWeightWarning(order: any): boolean {
  const weights = buildInitialFulfillmentWeights(order?.items);
  return detectFulfillmentWeightAnomalies(order?.items, weights).length > 0;
}

/**
 * Resume resultados de un lote de facturación usando suma entera en pesos (BigInt).
 */
export function summarizeBatchInvoiceResults(results: BatchInvoiceResult[]): BatchInvoiceSummary {
  let invoicedCount = 0;
  let errorCount = 0;
  let invoicedTotalPesos = 0n;

  for (const r of results) {
    if (r.status === 'INVOICED') {
      invoicedCount += 1;
      invoicedTotalPesos += toOrderIntegerPesosBigInt(r.totalAmount ?? 0);
    } else if (r.status === 'ERROR') {
      errorCount += 1;
    }
  }

  return {
    invoicedCount,
    errorCount,
    invoicedTotalPesos,
  };
}
