import { OrderStatus } from '@prisma/client';

export type WebOrderStatusCode =
  | 'nuevo'
  | 'confirmado'
  | 'en_armado'
  | 'en_reparto'
  | 'entregado'
  | 'cancelado';

/**
 * Pedidos de prueba previos a la activación del puente en vivo (validado por dirección).
 * Se ignoran automáticamente salvo que se pida explícitamente `includeHistoricalTests: true`
 * o `onlyOrderIds`.
 */
export const DEFAULT_HISTORICAL_TEST_ORDER_IDS = ['DV-1004', 'DV-1005'] as const;

const WEB_METADATA_KEYS = [
  'webOrderId',
  'webOrderSource',
  'webCustomerPhone',
  'webDeliveryMethod',
  'webOriginalTotal',
  'syncedAt',
] as const;

export function resolveIgnoredWebOrderIds(params: {
  skipOrderIds?: string[];
  onlyOrderIds?: string[];
  includeHistoricalTests?: boolean;
  envIgnoreRaw?: string;
}): Set<string> {
  const result = new Set<string>();

  if (!params.includeHistoricalTests && (!params.onlyOrderIds || params.onlyOrderIds.length === 0)) {
    for (const id of DEFAULT_HISTORICAL_TEST_ORDER_IDS) {
      result.add(id);
    }
    if (params.envIgnoreRaw) {
      for (const token of params.envIgnoreRaw.split(',')) {
        const clean = token.trim().toUpperCase();
        if (clean) result.add(clean);
      }
    }
  }

  for (const id of params.skipOrderIds || []) {
    const clean = id.trim().toUpperCase();
    if (clean) result.add(clean);
  }

  return result;
}

export function extractWebOrderIdFromOrder(order: {
  bultosDetails?: unknown;
  notes?: string | null;
}): string | null {
  if (order.bultosDetails && typeof order.bultosDetails === 'object' && !Array.isArray(order.bultosDetails)) {
    const rawCode = (order.bultosDetails as Record<string, unknown>).webOrderId;
    if (typeof rawCode === 'string' && rawCode.trim().length > 0) {
      return rawCode.trim().toUpperCase();
    }
  }

  if (typeof order.notes === 'string' && order.notes.trim().length > 0) {
    const match = order.notes.trim().match(/^\[(DV-\d+)\]/i);
    if (match?.[1]) {
      return match[1].toUpperCase();
    }
  }

  return null;
}

/**
 * Cuando Depósito cierra bultos físicos (`{ frio, secos, tabla, cajasCerradas }`),
 * preserva intactas las claves inmutables de trazabilidad Web/WhatsApp (`webOrderId`, etc.).
 */
export function mergeOrderBultosPreservingWebMetadata(
  existingBultosDetails: unknown,
  incomingBultosDetails: unknown,
): unknown {
  if (incomingBultosDetails === undefined) {
    return undefined;
  }

  const existingObj =
    existingBultosDetails && typeof existingBultosDetails === 'object' && !Array.isArray(existingBultosDetails)
      ? (existingBultosDetails as Record<string, unknown>)
      : null;

  if (!existingObj || typeof existingObj.webOrderId !== 'string') {
    return incomingBultosDetails;
  }

  const preservedMeta: Record<string, unknown> = {};
  for (const key of WEB_METADATA_KEYS) {
    if (existingObj[key] !== undefined) {
      preservedMeta[key] = existingObj[key];
    }
  }

  if (incomingBultosDetails && typeof incomingBultosDetails === 'object' && !Array.isArray(incomingBultosDetails)) {
    return {
      ...(incomingBultosDetails as Record<string, unknown>),
      ...preservedMeta,
    };
  }

  return {
    ...preservedMeta,
    pickingBultosNote: incomingBultosDetails,
  };
}

export function mapErpStatusToWebOrderStatus(erpStatus: OrderStatus): WebOrderStatusCode {
  switch (erpStatus) {
    case OrderStatus.PENDING:
      return 'confirmado';
    case OrderStatus.PREPARING:
      return 'en_armado';
    case OrderStatus.PREPARED:
      return 'en_reparto';
    case OrderStatus.DELIVERED:
      return 'entregado';
    case OrderStatus.CANCELLED:
      return 'cancelado';
    default:
      return 'confirmado';
  }
}

export function buildWebOrderStatusHistoryNote(
  erpOrderId: number,
  erpStatus: OrderStatus,
  extraNote?: string,
): string {
  const baseByStatus: Record<OrderStatus, string> = {
    [OrderStatus.PENDING]: `Recibido automáticamente en ERP-CRM DV (Pedido #${erpOrderId})`,
    [OrderStatus.PREPARING]: `En preparación en depósito (ERP Pedido #${erpOrderId})`,
    [OrderStatus.PREPARED]: `Armado finalizado y listo para despacho (ERP Pedido #${erpOrderId})`,
    [OrderStatus.DELIVERED]: `Facturado / entregado en ERP-CRM DV (Pedido #${erpOrderId})`,
    [OrderStatus.CANCELLED]: `Pedido anulado en ERP-CRM DV (Pedido #${erpOrderId})`,
  };
  const base = baseByStatus[erpStatus] || `Estado actualizado en ERP (#${erpOrderId})`;
  return extraNote ? `${base} — ${extraNote}` : base;
}
