import {
  PRINT_FONT_STACK,
  escapePrintHtml,
  getZoneDisplayTitle,
  openPrintDocument,
} from './printFormatters';
import { buildConsolidatedBilledReport } from './consolidatedBilled.helper';

export interface ConsolidatedBilledTripMeta {
  routeId?: number;
  driverName?: string;
  companionName?: string;
  vehiclePlate?: string;
}

export const printConsolidatedBilledA4 = ({
  orders,
  zone = 'ALL',
  filterLabel = 'Facturados',
  tripMeta,
}: {
  orders: any[];
  zone?: string;
  filterLabel?: string;
  tripMeta?: ConsolidatedBilledTripMeta;
}) => {
  const report = buildConsolidatedBilledReport(orders, zone);
  const zoneTitle = getZoneDisplayTitle(zone);

  const normalizedFilter = (filterLabel || '').trim();
  const hasSpecificFilter =
    normalizedFilter.length > 0 &&
    normalizedFilter.toLowerCase() !== 'general' &&
    normalizedFilter.toLowerCase() !== 'todos los pedidos';

  const metaParts: string[] = [];
  if (tripMeta?.routeId) metaParts.push(`Viaje #${tripMeta.routeId}`);
  if (tripMeta?.driverName) metaParts.push(escapePrintHtml(tripMeta.driverName));
  if (tripMeta?.vehiclePlate) metaParts.push(escapePrintHtml(tripMeta.vehiclePlate));
  if (zone !== 'ALL') metaParts.push(escapePrintHtml(zoneTitle));
  if (hasSpecificFilter && !tripMeta?.routeId) metaParts.push(escapePrintHtml(normalizedFilter));
  metaParts.push(`${report.ordersCount} ${report.ordersCount === 1 ? 'comprobante' : 'comprobantes'}`);
  if (report.totalBultos > 0) {
    metaParts.push(`${report.totalBultos} ${report.totalBultos === 1 ? 'bulto' : 'bultos'}`);
  }
  metaParts.push(`${report.productsCount} ${report.productsCount === 1 ? 'producto' : 'productos'}`);
  metaParts.push(
    `${new Date().toLocaleDateString('es-AR')} ${new Date().toLocaleTimeString('es-AR', {
      hour: '2-digit',
      minute: '2-digit',
    })}`,
  );

  let currentZone = '';
  const rowsHtml = report.items
    .map((item) => {
      const zoneHeaderHtml =
        item.pickingZone !== currentZone
          ? `<tr class="zone-row${currentZone === '' ? ' zone-row-first' : ''}"><td colspan="5">${escapePrintHtml(item.pickingZone)}</td></tr>`
          : '';
      currentZone = item.pickingZone;

      const breakdownText = item.orderBreakdown
        .map((b) => {
          const qtyDetail = b.weightKgLabel ? `${b.quantityLabel} · ${b.weightKgLabel}` : b.quantityLabel;
          return `<strong>${escapePrintHtml(b.docLabel)}</strong> ${escapePrintHtml(b.clientName)} (${escapePrintHtml(qtyDetail)})`;
        })
        .join(' &middot; ');

      const isMissingLoc = item.location.trim().toUpperCase() === 'S/U';
      const weightLine = item.totalWeightKgLabel
        ? `<div class="qty-weight">${item.hasEstimatedWeight ? '~' : ''}${escapePrintHtml(item.totalWeightKgLabel)}</div>`
        : '';

      return `${zoneHeaderHtml}<tr class="item-row">
        <td class="col-ok"><div class="chk-box"></div></td>
        <td class="col-loc"><span class="${isMissingLoc ? 'loc-missing' : 'loc-code'}">${escapePrintHtml(item.location)}</span></td>
        <td class="col-product">${escapePrintHtml(item.productName)}</td>
        <td class="col-qty">
          <div class="qty-val">${escapePrintHtml(item.totalQuantityLabel)}</div>
          ${weightLine}
        </td>
        <td class="col-breakdown">${breakdownText}</td>
      </tr>`;
    })
    .join('');

  const summaryParts = [
    `Total unidades/cajas: <strong>${escapePrintHtml(report.totalUnitsLabel)}</strong>`,
  ];
  if (report.totalWeightKgLabel) {
    summaryParts.push(`Peso facturado: <strong>${escapePrintHtml(report.totalWeightKgLabel)}</strong>`);
  }
  if (report.totalBultos > 0) {
    summaryParts.push(`Bultos: <strong>${report.totalBultos}</strong>`);
  }

  const docTitle = tripMeta?.routeId
    ? `Consolidado Facturado - Viaje #${tripMeta.routeId}`
    : `Consolidado Facturado - ${normalizedFilter || 'General'}`;

  openPrintDocument(
    'width=1000,height=1200',
    `<!DOCTYPE html>
    <html>
      <head>
        <title>${escapePrintHtml(docTitle)}</title>
        <style>
          @page { size: A4 portrait; margin: 8mm 10mm; }
          * { box-sizing: border-box; }
          body { font-family: ${PRINT_FONT_STACK}; margin: 0; padding: 0; color: #111827; font-size: 11.5px; line-height: 1.3; background: #fff; }
          .header-bar { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; border-bottom: 1.5px solid #111827; padding-bottom: 5px; margin-bottom: 8px; }
          .doc-title { font-size: 13px; font-weight: 800; letter-spacing: -0.01em; text-transform: uppercase; color: #111827; }
          .meta-bar { font-size: 10px; color: #4b5563; font-variant-numeric: tabular-nums; text-align: right; }
          table.consolidated-table { width: 100%; border-collapse: collapse; }
          thead { display: table-header-group; }
          table.consolidated-table th { border-bottom: 1.5px solid #111827; padding: 4px 6px; font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.04em; font-weight: 700; text-align: left; color: #4b5563; }
          table.consolidated-table td { border-bottom: 1px solid #e5e7eb; padding: 4px 6px; vertical-align: middle; }
          tr.item-row { break-inside: avoid; page-break-inside: avoid; }
          tr.zone-row { break-after: avoid; page-break-after: avoid; }
          tr.zone-row td { padding: 10px 6px 3px; font-size: 10px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: #111827; border-bottom: 1.5px solid #111827; }
          tr.zone-row-first td { padding-top: 6px; }
          .col-ok { width: 28px; text-align: center; }
          .col-loc { width: 1%; white-space: nowrap; padding-right: 8px; }
          .col-product { font-size: 12px; font-weight: 700; color: #111827; }
          .col-qty { width: 84px; text-align: center; font-variant-numeric: tabular-nums; }
          .col-breakdown { font-size: 10.5px; color: #374151; line-height: 1.28; }
          .chk-box { width: 15px; height: 15px; border: 1.5px solid #374151; border-radius: 2px; display: block; margin: 0 auto; }
          .loc-code { font-size: 10.5px; font-weight: 600; color: #4b5563; font-variant-numeric: tabular-nums; }
          .loc-missing { font-size: 10px; font-weight: 600; color: #9ca3af; }
          .qty-val { font-size: 13.5px; font-weight: 800; color: #111827; line-height: 1.1; }
          .qty-weight { font-size: 9.5px; font-weight: 600; color: #374151; margin-top: 1px; }
          .footer-bar { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; margin-top: 14px; padding-top: 8px; border-top: 1.5px solid #111827; font-size: 10px; color: #374151; break-inside: avoid; page-break-inside: avoid; }
          .signatures { display: flex; gap: 24px; }
          .sig-field { display: inline-flex; align-items: baseline; gap: 6px; font-weight: 600; }
          .sig-line { display: inline-block; width: 130px; border-bottom: 1px solid #6b7280; height: 10px; }
          @media print { body { -webkit-print-color-adjust: exact; } }
        </style>
      </head>
      <body>
        <div class="header-bar">
          <div class="doc-title">Consolidado Facturado</div>
          <div class="meta-bar">${metaParts.join(' &middot; ')}</div>
        </div>
        <table class="consolidated-table">
          <thead>
            <tr>
              <th class="col-ok">OK</th>
              <th class="col-loc">Ubic.</th>
              <th>Producto</th>
              <th class="col-qty">Facturado</th>
              <th>Comprobantes / Clientes</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
        <div class="footer-bar">
          <div>${summaryParts.join(' &middot; ')}</div>
          <div class="signatures">
            <div class="sig-field">Controló:<span class="sig-line"></span></div>
            <div class="sig-field">Chofer:<span class="sig-line"></span></div>
          </div>
        </div>
        <script>
          window.onload = function() {
            setTimeout(() => {
              window.print();
            }, 400);
          };
        </script>
      </body>
    </html>`,
  );
};
