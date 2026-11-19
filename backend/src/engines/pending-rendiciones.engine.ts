import { Decimal } from 'decimal.js';
import { type NumericInput, roundToIntegerPeso } from '../core/money';

export type CollectorChannel = 'DRIVER' | 'SELLER';

export interface RawOpenFieldSettlement {
  id: number;
  collectorUserId: number;
  status: string;
  deliveryRouteId?: number | null;
  expectedCash: NumericInput;
  expectedChecksCount: number;
  expectedChecksAmount: NumericInput;
  pendingTransfersAmount: NumericInput;
  createdAt?: Date | string;
  collector?: {
    id: number;
    username: string;
    role: string;
  } | null;
  deliveryRoute?: {
    id: number;
    driverName?: string | null;
    vehiclePlate?: string | null;
  } | null;
  receipts?: Array<{
    id: number;
    status?: string;
    deliveryRouteId?: number | null;
  }>;
}

export interface PendingFieldSettlementSummary {
  id: number;
  collectorUserId: number;
  collectorName: string;
  collectorRole: string;
  channel: CollectorChannel;
  deliveryRouteId: number | null;
  routeLabel: string | null;
  status: string;
  receiptCount: number;
  expectedCash: number;
  expectedChecksCount: number;
  expectedChecksAmount: number;
  pendingTransfersAmount: number;
  totalPending: number;
}

const OPEN_SETTLEMENT_STATUSES = new Set(['OPEN', 'SUBMITTED']);

export function classifyCollectorChannel(params: {
  deliveryRouteId?: number | null;
  receiptDeliveryRouteIds?: Array<number | null | undefined>;
  collectorRole?: string | null;
}): CollectorChannel {
  if (params.deliveryRouteId != null) return 'DRIVER';
  if (params.receiptDeliveryRouteIds?.some((id) => id != null)) return 'DRIVER';
  if (String(params.collectorRole || '').toUpperCase() === 'DEPOSITO') return 'DRIVER';
  return 'SELLER';
}

export function summarizeOpenFieldSettlements(
  rawSettlements: RawOpenFieldSettlement[],
): PendingFieldSettlementSummary[] {
  const result: PendingFieldSettlementSummary[] = [];

  for (const s of rawSettlements) {
    if (!OPEN_SETTLEMENT_STATUSES.has(String(s.status || '').toUpperCase())) continue;

    const activeReceipts = (s.receipts || []).filter(
      (r) => String(r.status || '').toUpperCase() !== 'VOIDED',
    );
    const cashDec = roundToIntegerPeso(s.expectedCash ?? 0);
    const checksDec = roundToIntegerPeso(s.expectedChecksAmount ?? 0);
    const transfersDec = roundToIntegerPeso(s.pendingTransfersAmount ?? 0);
    const totalDec = new Decimal(cashDec).plus(checksDec).plus(transfersDec);

    if (activeReceipts.length === 0 && totalDec.lte(0)) continue;

    const channel = classifyCollectorChannel({
      deliveryRouteId: s.deliveryRouteId,
      receiptDeliveryRouteIds: activeReceipts.map((r) => r.deliveryRouteId),
      collectorRole: s.collector?.role,
    });

    const resolvedRouteId =
      s.deliveryRouteId ??
      activeReceipts.find((r) => r.deliveryRouteId != null)?.deliveryRouteId ??
      null;

    const routeLabel = s.deliveryRoute
      ? s.deliveryRoute.vehiclePlate
        ? `Viaje #${s.deliveryRoute.id} (${s.deliveryRoute.vehiclePlate})`
        : `Viaje #${s.deliveryRoute.id}`
      : resolvedRouteId != null
        ? `Viaje #${resolvedRouteId}`
        : null;

    result.push({
      id: s.id,
      collectorUserId: s.collectorUserId,
      collectorName: s.collector?.username || `Cobrador #${s.collectorUserId}`,
      collectorRole: s.collector?.role || 'VENDEDOR',
      channel,
      deliveryRouteId: resolvedRouteId,
      routeLabel,
      status: s.status,
      receiptCount: activeReceipts.length,
      expectedCash: cashDec.toNumber(),
      expectedChecksCount: Number(s.expectedChecksCount || 0),
      expectedChecksAmount: checksDec.toNumber(),
      pendingTransfersAmount: transfersDec.toNumber(),
      totalPending: totalDec.toNumber(),
    });
  }

  return result;
}
