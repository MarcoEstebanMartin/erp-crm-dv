import type { CollectorSettlementDTO, FieldReceiptDTO } from '../../api/fieldReceipts.api';

export type CollectorChannel = 'DRIVER' | 'SELLER';

export function resolveFieldReceiptChannel(
  receipt: FieldReceiptDTO & { deliveryRouteId?: number | null },
  settlement?: (CollectorSettlementDTO & { deliveryRouteId?: number | null }) | null,
): CollectorChannel {
  if (receipt.deliveryRouteId != null) return 'DRIVER';
  if (settlement?.deliveryRouteId != null) return 'DRIVER';
  if (String(settlement?.collector?.role || '').toUpperCase() === 'DEPOSITO') return 'DRIVER';
  return 'SELLER';
}

export function resolveSettlementChannel(
  settlement: CollectorSettlementDTO & { deliveryRouteId?: number | null },
): CollectorChannel {
  if (settlement.deliveryRouteId != null) return 'DRIVER';
  const activeReceipts = (settlement.receipts || []).filter((r) => r.status !== 'VOIDED');
  if (activeReceipts.some((r) => (r as FieldReceiptDTO & { deliveryRouteId?: number | null }).deliveryRouteId != null)) {
    return 'DRIVER';
  }
  if (String(settlement.collector?.role || '').toUpperCase() === 'DEPOSITO') return 'DRIVER';
  return 'SELLER';
}

export function isPendingOpenSettlement(settlement: CollectorSettlementDTO): boolean {
  if (settlement.status !== 'OPEN' && settlement.status !== 'SUBMITTED') return false;
  const total =
    Math.round(Number(settlement.expectedCash || 0)) +
    Math.round(Number(settlement.expectedChecksAmount || 0)) +
    Math.round(Number(settlement.pendingTransfersAmount || 0));
  return total > 0 || Number(settlement.expectedChecksCount || 0) > 0;
}
