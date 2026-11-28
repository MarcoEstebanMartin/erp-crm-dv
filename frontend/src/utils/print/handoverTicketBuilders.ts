import type { CollectorSettlementDTO } from '../../api/fieldReceipts.api';
import { roundIntPesoPrint } from './printFormatters';

export type HandoverTicketKind = 'FIELD_SETTLEMENT' | 'ARQUEO' | 'ROUTE_CLOSURE';

export interface HandoverTicketReceiptLine {
  code: string;
  clientName: string;
  amount: number;
}

export interface HandoverTicketData {
  kind: HandoverTicketKind;
  voucherCode: string;
  timestampIso: string;
  deliveredBy: string;
  deliveredByRole?: string;
  receivedBy: string;
  reference?: string | null;
  vehicleInfo?: string | null;
  cashAmount: number;
  expectedCashAmount?: number | null;
  checksAmount: number;
  checksCount?: number;
  transfersAmount: number;
  creditAmount?: number;
  notDeliveredCount?: number;
  notDeliveredAmount?: number;
  totalDelivered: number;
  difference?: number | null;
  receiptsCount?: number;
  receiptLines?: HandoverTicketReceiptLine[];
  notes?: string | null;
  isReprint?: boolean;
}

export function formatTicketTimestampAr(isoOrDate: string | Date): string {
  const date = isoOrDate instanceof Date ? isoOrDate : new Date(isoOrDate);
  if (Number.isNaN(date.getTime())) return '—';
  const parts = new Intl.DateTimeFormat('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00';
  return `${get('day')}/${get('month')}/${get('year')} ${get('hour')}:${get('minute')}:${get('second')}`;
}

export function buildFieldSettlementTicketData(
  settlement: CollectorSettlementDTO,
  opts: {
    declaredCash: number;
    receivedBy: string;
    approvedAt?: string | null;
    isReprint?: boolean;
  },
): HandoverTicketData {
  const activeReceipts = (settlement.receipts || []).filter((r) => r.status !== 'VOIDED');
  const cashAmount = roundIntPesoPrint(opts.declaredCash);
  const expectedCashAmount = roundIntPesoPrint(settlement.expectedCash || 0);
  const checksAmount = roundIntPesoPrint(settlement.expectedChecksAmount || 0);
  const transfersAmount = roundIntPesoPrint(settlement.pendingTransfersAmount || 0);
  const totalDelivered = cashAmount + checksAmount + transfersAmount;
  const difference =
    settlement.cashDifference != null
      ? roundIntPesoPrint(settlement.cashDifference)
      : expectedCashAmount > 0
        ? cashAmount - expectedCashAmount
        : 0;
  const routeId = (settlement as CollectorSettlementDTO & { deliveryRouteId?: number | null }).deliveryRouteId;
  const role = settlement.collector?.role === 'REPARTIDOR' ? 'Chofer' : 'Vendedor';

  return {
    kind: 'FIELD_SETTLEMENT',
    voucherCode: `REND-${String(settlement.id).padStart(5, '0')}`,
    timestampIso: opts.approvedAt || settlement.approvedAt || new Date().toISOString(),
    deliveredBy: settlement.collector?.username || `Cobrador #${settlement.collectorUserId}`,
    deliveredByRole: role,
    receivedBy: opts.receivedBy || 'Caja / Administración',
    reference: routeId != null ? `Viaje #${routeId}` : null,
    cashAmount,
    expectedCashAmount: expectedCashAmount > 0 ? expectedCashAmount : null,
    checksAmount,
    checksCount: settlement.expectedChecksCount || 0,
    transfersAmount,
    totalDelivered,
    difference,
    receiptsCount: activeReceipts.length,
    receiptLines: activeReceipts.map((r) => ({
      code: r.receiptNumber || r.provisionalCode || `#${r.id}`,
      clientName: r.persona?.name || `Cliente #${r.personaId}`,
      amount: roundIntPesoPrint(r.totalAmount || 0),
    })),
    isReprint: Boolean(opts.isReprint),
  };
}

export function buildArqueoTicketData(
  arqueoResult: any,
  opts: { receivedBy: string; isReprint?: boolean },
): HandoverTicketData {
  const drawer = arqueoResult?.drawer || {};
  const receipts: any[] = Array.isArray(arqueoResult?.verifiedReceipts)
    ? arqueoResult.verifiedReceipts
    : [];

  let cashFromReceipts = 0;
  let checksFromReceipts = 0;
  let checksCount = 0;
  let transfersFromReceipts = 0;

  for (const r of receipts) {
    const amt = roundIntPesoPrint(r.amount || 0);
    if (r.paymentMethod === 'CASH') cashFromReceipts += amt;
    else if (r.paymentMethod === 'CHECK') {
      checksFromReceipts += amt;
      checksCount += 1;
    } else if (r.paymentMethod === 'BANK_TRANSFER') {
      transfersFromReceipts += amt;
    }
  }

  const difference = roundIntPesoPrint(arqueoResult?.difference ?? 0);
  const totalDelivered = roundIntPesoPrint(
    cashFromReceipts + checksFromReceipts + transfersFromReceipts + difference,
  );
  const cashDelivered = Math.max(0, cashFromReceipts + difference);

  return {
    kind: 'ARQUEO',
    voucherCode: `ARQ-${String(drawer.id || 0).padStart(5, '0')}`,
    timestampIso: drawer.closedAt || new Date().toISOString(),
    deliveredBy: String(drawer.branch || 'Cobrador'),
    receivedBy: opts.receivedBy || 'Caja / Administración',
    reference: drawer.routeNote || null,
    cashAmount: cashDelivered,
    expectedCashAmount: cashFromReceipts,
    checksAmount: checksFromReceipts,
    checksCount,
    transfersAmount: transfersFromReceipts,
    totalDelivered: totalDelivered > 0 ? totalDelivered : roundIntPesoPrint(drawer.realBalance || 0),
    difference,
    receiptsCount: receipts.length,
    receiptLines: receipts.map((r) => ({
      code: r.receiptNumber || `#${r.id}`,
      clientName: r.clientName || 'Cliente',
      amount: roundIntPesoPrint(r.amount || 0),
    })),
    notes: drawer.notes || null,
    isReprint: Boolean(opts.isReprint),
  };
}

export function buildRouteClosureTicketData(
  route: any,
  opts: {
    cashAmount: number;
    checksAmount: number;
    transfersAmount: number;
    creditAmount?: number;
    notDeliveredCount?: number;
    notDeliveredAmount?: number;
    ordersCount?: number;
    receivedBy: string;
    closedAt?: string | null;
    isReprint?: boolean;
  },
): HandoverTicketData {
  const cashAmount = roundIntPesoPrint(opts.cashAmount);
  const checksAmount = roundIntPesoPrint(opts.checksAmount);
  const transfersAmount = roundIntPesoPrint(opts.transfersAmount);
  const totalDelivered = cashAmount + checksAmount + transfersAmount;
  const companion = route?.companionName ? ` + ${route.companionName}` : '';
  const vehicle = [route?.vehiclePlate, route?.vehicleDescription].filter(Boolean).join(' · ');

  return {
    kind: 'ROUTE_CLOSURE',
    voucherCode: `VIAJE-${String(route?.id || 0).padStart(5, '0')}`,
    timestampIso: opts.closedAt || route?.updatedAt || new Date().toISOString(),
    deliveredBy: `${route?.driverName || 'Chofer'}${companion}`,
    deliveredByRole: 'Chofer',
    receivedBy: opts.receivedBy || 'Caja / Administración',
    reference: `Viaje #${route?.id ?? '—'}`,
    vehicleInfo: vehicle || null,
    cashAmount,
    checksAmount,
    transfersAmount,
    creditAmount: opts.creditAmount != null ? roundIntPesoPrint(opts.creditAmount) : undefined,
    notDeliveredCount: opts.notDeliveredCount,
    notDeliveredAmount:
      opts.notDeliveredAmount != null ? roundIntPesoPrint(opts.notDeliveredAmount) : undefined,
    totalDelivered,
    receiptsCount: opts.ordersCount ?? (Array.isArray(route?.orders) ? route.orders.length : 0),
    isReprint: Boolean(opts.isReprint),
  };
}
