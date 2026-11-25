import type { CollectorSettlementDTO } from '../../api/fieldReceipts.api';
import {
  escapePrintHtml,
  formatArsPrint,
  openPrintDocument,
  roundIntPesoPrint,
} from './printFormatters';

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

const KIND_SUBTITLE: Record<HandoverTicketKind, string> = {
  FIELD_SETTLEMENT: 'RENDICIÓN DE CALLE',
  ARQUEO: 'ARQUEO DE RENDICIÓN',
  ROUTE_CLOSURE: 'CIERRE DE RUTA DE REPARTO',
};

const MAX_INLINE_RECEIPTS = 12;

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

export function buildHandoverTicket80mmHtml(data: HandoverTicketData): string {
  const formattedTs = formatTicketTimestampAr(data.timestampIso);
  const subtitle = KIND_SUBTITLE[data.kind];
  const lines = data.receiptLines || [];
  const visibleLines = lines.slice(0, MAX_INLINE_RECEIPTS);
  const hiddenLinesCount = Math.max(0, lines.length - visibleLines.length);

  const differenceVal = data.difference != null ? roundIntPesoPrint(data.difference) : 0;
  const differenceLabel =
    differenceVal === 0
      ? ''
      : differenceVal < 0
        ? `FALTANTE: -$${formatArsPrint(Math.abs(differenceVal))}`
        : `SOBRANTE: +$${formatArsPrint(differenceVal)}`;

  const receiptRowsHtml = visibleLines
    .map(
      (line) => `<tr>
        <td class="col-code">${escapePrintHtml(line.code)}</td>
        <td class="col-client">${escapePrintHtml(line.clientName.slice(0, 18))}</td>
        <td class="text-right">$${formatArsPrint(line.amount)}</td>
      </tr>`,
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <title>Ticket ${escapePrintHtml(data.voucherCode)}</title>
    <style>
      @page {
        size: 80mm auto;
        margin: 0;
      }
      * {
        box-sizing: border-box;
      }
      body {
        width: 72mm;
        margin: 0 auto;
        padding: 3mm 0 4mm;
        font-family: 'Courier New', Courier, monospace;
        font-size: 11.5px;
        line-height: 1.35;
        color: #000;
        background: #fff;
        font-variant-numeric: tabular-nums;
      }
      .center { text-align: center; }
      .bold { font-weight: 700; }
      .doc-title { font-size: 12.5px; font-weight: 700; letter-spacing: 0.3px; }
      .reprint-tag {
        margin: 4px 0;
        padding: 2px 4px;
        border: 1px solid #000;
        text-align: center;
        font-weight: 700;
        font-size: 11px;
      }
      .audit-ts {
        font-size: 13.5px;
        font-weight: 700;
        text-align: center;
        margin: 3px 0 2px;
      }
      .divider {
        border-top: 1px dashed #000;
        margin: 6px 0;
      }
      .kv {
        display: flex;
        justify-content: space-between;
        gap: 6px;
        margin: 2px 0;
      }
      .kv-label { flex-shrink: 0; }
      .kv-val { text-align: right; word-break: break-word; }
      .total-row {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        font-size: 15px;
        font-weight: 700;
        margin: 4px 0;
      }
      .diff-row {
        margin-top: 4px;
        text-align: center;
        font-weight: 700;
        font-size: 11.5px;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        font-size: 10.5px;
      }
      th {
        text-align: left;
        border-bottom: 1px solid #000;
        padding: 2px 0;
      }
      td {
        padding: 2px 0;
        vertical-align: top;
      }
      .col-code { white-space: nowrap; padding-right: 4px; }
      .col-client { padding-right: 4px; }
      .text-right { text-align: right; white-space: nowrap; }
    </style>
  </head>
  <body>
    <div class="center">
      <div class="doc-title">${escapePrintHtml(subtitle)}</div>
      <div class="bold">${escapePrintHtml(data.voucherCode)}</div>
      <div class="audit-ts">${escapePrintHtml(formattedTs)}</div>
    </div>

    ${data.isReprint ? `<div class="reprint-tag">REIMPRESIÓN</div>` : ''}

    <div class="divider"></div>

    <div class="kv">
      <span class="kv-label">Entregó${data.deliveredByRole ? ` (${escapePrintHtml(data.deliveredByRole)})` : ''}:</span>
      <span class="kv-val bold">${escapePrintHtml(data.deliveredBy)}</span>
    </div>
    <div class="kv">
      <span class="kv-label">Recibió:</span>
      <span class="kv-val">${escapePrintHtml(data.receivedBy)}</span>
    </div>
    ${data.reference ? `<div class="kv"><span class="kv-label">Ref:</span><span class="kv-val">${escapePrintHtml(data.reference)}</span></div>` : ''}
    ${data.vehicleInfo ? `<div class="kv"><span class="kv-label">Vehículo:</span><span class="kv-val">${escapePrintHtml(data.vehicleInfo)}</span></div>` : ''}

    <div class="divider"></div>

    <div class="kv">
      <span>Efectivo</span>
      <span class="bold">$${formatArsPrint(data.cashAmount)}</span>
    </div>
    ${
      data.expectedCashAmount != null && data.expectedCashAmount > 0 && data.expectedCashAmount !== data.cashAmount
        ? `<div class="kv">
            <span>Esperado</span>
            <span>$${formatArsPrint(data.expectedCashAmount)}</span>
          </div>`
        : ''
    }
    ${
      data.checksAmount > 0
        ? `<div class="kv">
            <span>Cheques${data.checksCount ? ` (${data.checksCount})` : ''}</span>
            <span class="bold">$${formatArsPrint(data.checksAmount)}</span>
          </div>`
        : ''
    }
    ${
      data.transfersAmount > 0
        ? `<div class="kv">
            <span>Transferencias</span>
            <span class="bold">$${formatArsPrint(data.transfersAmount)}</span>
          </div>`
        : ''
    }
    ${
      data.creditAmount != null && data.creditAmount > 0
        ? `<div class="kv">
            <span>A Cuenta (C/C)</span>
            <span>$${formatArsPrint(data.creditAmount)}</span>
          </div>`
        : ''
    }
    ${
      data.notDeliveredCount != null && data.notDeliveredCount > 0
        ? `<div class="kv">
            <span>No entregados (${data.notDeliveredCount})</span>
            <span>$${formatArsPrint(data.notDeliveredAmount || 0)}</span>
          </div>`
        : ''
    }

    <div class="divider"></div>

    <div class="total-row">
      <span>TOTAL</span>
      <span>$${formatArsPrint(data.totalDelivered)}</span>
    </div>

    ${differenceLabel ? `<div class="diff-row">${escapePrintHtml(differenceLabel)}</div>` : ''}

    ${
      visibleLines.length > 0
        ? `<div class="divider"></div>
          <div class="bold" style="margin-bottom: 3px;">COMPROBANTES (${data.receiptsCount ?? lines.length})</div>
          <table>
            <thead>
              <tr>
                <th>N°</th>
                <th>Cliente</th>
                <th class="text-right">Monto</th>
              </tr>
            </thead>
            <tbody>
              ${receiptRowsHtml}
            </tbody>
          </table>
          ${hiddenLinesCount > 0 ? `<div class="center" style="font-size: 10px; margin-top: 3px;">... y ${hiddenLinesCount} más en sistema</div>` : ''}`
        : data.receiptsCount != null && data.receiptsCount > 0
          ? `<div class="divider"></div>
            <div class="kv">
              <span>${data.kind === 'ROUTE_CLOSURE' ? 'Pedidos en ruta' : 'Comprobantes'}</span>
              <span class="bold">${data.receiptsCount}</span>
            </div>`
          : ''
    }

    ${data.notes ? `<div class="divider"></div><div style="font-size: 10.5px;"><strong>Obs:</strong> ${escapePrintHtml(data.notes)}</div>` : ''}

    <script>
      window.onload = function () {
        setTimeout(function () {
          window.print();
          window.close();
        }, 200);
      };
    </script>
  </body>
</html>`;
}

export function printHandoverTicket80mm(data: HandoverTicketData): void {
  const html = buildHandoverTicket80mmHtml(data);
  openPrintDocument('width=420,height=720', html);
}

export function printCompletedRouteReprintTicket(route: any, receivedBy: string): void {
  let cashAmount = 0;
  let checksAmount = 0;
  let transfersAmount = 0;

  for (const r of route?.fieldReceipts || []) {
    if (r.status === 'VOIDED') continue;
    for (const p of r.payments || []) {
      if (p.status === 'REJECTED') continue;
      const amt = roundIntPesoPrint(p.amount || 0);
      if (p.paymentMethod === 'CASH') cashAmount += amt;
      else if (p.paymentMethod === 'CHECK') checksAmount += amt;
      else if (p.paymentMethod === 'BANK_TRANSFER') transfersAmount += amt;
    }
  }
  for (const o of route?.orders || []) {
    for (const t of o.transactions || []) {
      if (t.type !== 'INCOME' || t.voidedAt) continue;
      const amt = roundIntPesoPrint(t.amount || 0);
      if (t.paymentMethod === 'CASH') cashAmount += amt;
      else if (t.paymentMethod === 'CHECK') checksAmount += amt;
      else if (t.paymentMethod === 'BANK_TRANSFER') transfersAmount += amt;
    }
  }

  printHandoverTicket80mm(
    buildRouteClosureTicketData(route, {
      cashAmount,
      checksAmount,
      transfersAmount,
      ordersCount: (route?.orders || []).length,
      receivedBy: receivedBy || 'Caja / Administración',
      closedAt: route?.updatedAt || route?.createdAt,
      isReprint: true,
    }),
  );
}
