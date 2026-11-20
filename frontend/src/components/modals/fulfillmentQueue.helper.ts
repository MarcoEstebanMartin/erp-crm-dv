import { BillingType } from '../../utils/types';
import { toOrderIntegerPesosBigInt } from '../../utils/fulfillmentCardMeta.helper';

export type QueueItemStatus = 'INVOICED' | 'SKIPPED';

export interface FulfillmentQueueResult {
  orderId: number;
  clientName: string;
  status: QueueItemStatus;
  billingType?: BillingType;
  invoiceNumber?: string | null;
  cae?: string | null;
  totalAmount?: number;
  invoicedOrder?: any;
}

export interface FulfillmentQueueSummary {
  invoicedCount: number;
  skippedCount: number;
  invoicedTotalPesos: bigint;
}

/**
 * Devuelve el siguiente índice de la cola o null si ya se procesó el último pedido.
 */
export function getNextQueueIndex(currentIndex: number, totalItems: number): number | null {
  if (totalItems <= 0) return null;
  const next = currentIndex + 1;
  return next < totalItems ? next : null;
}

/**
 * Resuelve qué pedidos entran a la cola de revisión y facturación:
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
 * Calcula contadores y monto total facturado usando aritmética entera (BigInt) en pesos.
 */
export function summarizeFulfillmentQueue(results: FulfillmentQueueResult[]): FulfillmentQueueSummary {
  let invoicedCount = 0;
  let skippedCount = 0;
  let invoicedTotalPesos = 0n;

  for (const r of results) {
    if (r.status === 'INVOICED') {
      invoicedCount += 1;
      invoicedTotalPesos += toOrderIntegerPesosBigInt(r.totalAmount ?? 0);
    } else if (r.status === 'SKIPPED') {
      skippedCount += 1;
    }
  }

  return {
    invoicedCount,
    skippedCount,
    invoicedTotalPesos,
  };
}
