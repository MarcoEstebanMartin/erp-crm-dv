import {
  buildRouteClosureTicketData,
  formatTicketTimestampAr,
  type HandoverTicketData,
  type HandoverTicketKind,
} from './handoverTicketBuilders';
import {
  escapePrintHtml,
  formatArsPrint,
  openPrintDocument,
  roundIntPesoPrint,
} from './printFormatters';

export * from './handoverTicketBuilders';

const KIND_SUBTITLE: Record<HandoverTicketKind, string> = {
  FIELD_SETTLEMENT: 'RENDICIÓN DE CALLE',
  ARQUEO: 'ARQUEO DE RENDICIÓN',
  ROUTE_CLOSURE: 'CIERRE DE RUTA DE REPARTO',
};

const MAX_INLINE_RECEIPTS = 12;

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
