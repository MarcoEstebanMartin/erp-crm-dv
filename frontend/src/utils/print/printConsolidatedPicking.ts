import {
  PRINT_FONT_STACK,
  escapePrintHtml,
  getZoneDisplayTitle,
  openPrintDocument,
  resolvePrintClientMeta,
} from './printFormatters';
import { SCALE, divRoundHalfUp, parseScaledBigInt } from '../exactStockMath';

interface ConsolidatedItem {
  productId: string;
  productName: string;
  pickingZone: string;
  location: string;
  isPesable: boolean;
  totalQuantity: number;
  approxWeightScaled: bigint;
  orderBreakdown: Array<{ orderId: number; clientName: string; quantity: number }>;
}

export const printConsolidatedPickingA4 = ({
  orders,
  zone = 'ALL',
  filterLabel = 'General',
}: {
  orders: any[];
  zone?: string;
  filterLabel?: string;
}) => {
  const getItemZone = (item: any) =>
    item.product?.pickingZone || item.product?.rubro?.pickingZone || 'CAJAS';
  const getItemLocation = (item: any) => item.product?.defaultLocation || item.location || 'S/U';

  const consolidatedMap = new Map<string, ConsolidatedItem>();

  orders.forEach((order) => {
    const client = resolvePrintClientMeta(order);
    (order.items || []).forEach((item: any) => {
      const itemZone = getItemZone(item);
      if (zone !== 'ALL' && itemZone !== zone) return;

      const pId = String(item.productId || item.product?.id || item.product?.name);
      const pName = item.product?.name || 'Artículo Desconocido';
      const loc = getItemLocation(item);
      const isPesable = Boolean(
        item.product?.isPesable || (item.weight && Number(item.weight) > 0),
      );
      const qtyScaled = parseScaledBigInt(item.quantity || 0);
      const approxScaled = parseScaledBigInt(item.product?.approximateWeight || 1);
      const itemApproxScaled = divRoundHalfUp(qtyScaled * approxScaled, SCALE);

      if (!consolidatedMap.has(pId)) {
        consolidatedMap.set(pId, {
          productId: pId,
          productName: pName,
          pickingZone: itemZone,
          location: loc,
          isPesable,
          totalQuantity: 0,
          approxWeightScaled: 0n,
          orderBreakdown: [],
        });
      }

      const entry = consolidatedMap.get(pId)!;
      entry.totalQuantity += Number(item.quantity);
      entry.approxWeightScaled += itemApproxScaled;
      entry.orderBreakdown.push({
        orderId: order.id,
        clientName: client.name,
        quantity: item.quantity,
      });
    });
  });

  const consolidatedList = Array.from(consolidatedMap.values()).sort((a, b) => {
    if (a.pickingZone !== b.pickingZone) return a.pickingZone.localeCompare(b.pickingZone);
    if (a.location !== b.location) return a.location.localeCompare(b.location);
    return a.productName.localeCompare(b.productName);
  });

  const zoneTitle = getZoneDisplayTitle(zone);
  const showPesoColumn =
    (zone === 'FRIO' || zone === 'ALL') && consolidatedList.some((item) => item.isPesable);
  const colCount = showPesoColumn ? 6 : 5;

  const normalizedFilter = (filterLabel || '').trim();
  const hasSpecificFilter =
    normalizedFilter.length > 0 &&
    normalizedFilter.toLowerCase() !== 'general' &&
    normalizedFilter.toLowerCase() !== 'todos los pedidos';

  const metaParts: string[] = [];
  if (zone !== 'ALL') metaParts.push(zoneTitle);
  if (hasSpecificFilter) metaParts.push(escapePrintHtml(normalizedFilter));
  metaParts.push(`${orders.length} ${orders.length === 1 ? 'pedido' : 'pedidos'}`);
  metaParts.push(`${consolidatedList.length} ${consolidatedList.length === 1 ? 'producto' : 'productos'}`);
  metaParts.push(
    `${new Date().toLocaleDateString('es-AR')} ${new Date().toLocaleTimeString('es-AR', {
      hour: '2-digit',
      minute: '2-digit',
    })}`,
  );

  let currentZone = '';
  const rowsHtml = consolidatedList
    .map((item) => {
      const zoneHeaderHtml =
        item.pickingZone !== currentZone
          ? `<tr class="zone-row${currentZone === '' ? ' zone-row-first' : ''}"><td colspan="${colCount}">${escapePrintHtml(item.pickingZone)}</td></tr>`
          : '';
      currentZone = item.pickingZone;

      const breakdownText = item.orderBreakdown
        .map(
          (b) =>
            `<strong>#${b.orderId}</strong> ${escapePrintHtml(b.clientName.split(' ')[0])} (${b.quantity})`,
        )
        .join(' &middot; ');
      const approxKgStr = (Number(item.approxWeightScaled) / Number(SCALE)).toFixed(1);
      const isMissingLoc = item.location.trim().toUpperCase() === 'S/U';

      return `${zoneHeaderHtml}<tr class="item-row">
        <td class="col-loc"><span class="${isMissingLoc ? 'loc-missing' : 'loc-code'}">${escapePrintHtml(item.location)}</span></td>
        <td class="col-ok"><div class="chk-box"></div></td>
        <td class="col-product">${escapePrintHtml(item.productName)}</td>
        <td class="col-qty">
          <div class="qty-val">${item.totalQuantity}</div>
          ${item.isPesable ? `<div class="qty-approx">~${approxKgStr} kg</div>` : ''}
        </td>
        <td class="col-breakdown">${breakdownText}</td>
        ${showPesoColumn ? `<td class="col-weight">${item.isPesable ? '<div class="weight-line"></div>' : ''}</td>` : ''}
      </tr>`;
    })
    .join('');

  const safeOrderIdsJson = JSON.stringify(orders.map((o) => Number(o.id) || 0));

  openPrintDocument(
    'width=1000,height=1200',
    `<!DOCTYPE html>
    <html>
      <head>
        <title>Armado - ${escapePrintHtml(filterLabel)}</title>
        <style>
          @page { size: A4 portrait; margin: 8mm 10mm; }
          * { box-sizing: border-box; }
          body { font-family: ${PRINT_FONT_STACK}; margin: 0; padding: 0; color: #111827; font-size: 11.5px; line-height: 1.3; background: #fff; }
          .meta-bar { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; font-size: 10px; color: #4b5563; margin-bottom: 6px; font-variant-numeric: tabular-nums; }
          .responsible-field { display: inline-flex; align-items: baseline; gap: 6px; color: #374151; font-weight: 600; }
          .responsible-line { display: inline-block; width: 140px; border-bottom: 1px solid #6b7280; height: 10px; }
          table.consolidated-table { width: 100%; border-collapse: collapse; }
          thead { display: table-header-group; }
          table.consolidated-table th { border-bottom: 1.5px solid #111827; padding: 4px 6px; font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.04em; font-weight: 700; text-align: left; color: #4b5563; }
          table.consolidated-table td { border-bottom: 1px solid #e5e7eb; padding: 4px 6px; vertical-align: middle; }
          tr.item-row { break-inside: avoid; page-break-inside: avoid; }
          tr.zone-row { break-after: avoid; page-break-after: avoid; }
          tr.zone-row td { padding: 10px 6px 3px; font-size: 10px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: #111827; border-bottom: 1.5px solid #111827; }
          tr.zone-row-first td { padding-top: 6px; }
          .col-loc { width: 1%; white-space: nowrap; padding-right: 8px; }
          .col-ok { width: 28px; text-align: center; }
          .col-product { font-size: 12px; font-weight: 700; color: #111827; }
          .col-qty { width: 72px; text-align: center; font-variant-numeric: tabular-nums; }
          .col-breakdown { font-size: 10.5px; color: #374151; line-height: 1.28; }
          .col-weight { width: 72px; text-align: center; }
          .chk-box { width: 15px; height: 15px; border: 1.5px solid #374151; border-radius: 2px; display: block; margin: 0 auto; }
          .loc-code { font-size: 10.5px; font-weight: 600; color: #4b5563; font-variant-numeric: tabular-nums; }
          .loc-missing { font-size: 10px; font-weight: 600; color: #9ca3af; }
          .qty-val { font-size: 13.5px; font-weight: 800; color: #111827; line-height: 1.1; }
          .qty-approx { font-size: 9px; color: #6b7280; margin-top: 1px; }
          .weight-line { width: 54px; height: 16px; border-bottom: 1px solid #374151; margin: 0 auto; }
          @media print { body { -webkit-print-color-adjust: exact; } }
        </style>
      </head>
      <body>
        <div class="meta-bar">
          <div class="responsible-field">Responsable:<span class="responsible-line"></span></div>
          <div>${metaParts.join(' &middot; ')}</div>
        </div>
        <table class="consolidated-table">
          <thead>
            <tr>
              <th class="col-loc">Ubic.</th>
              <th class="col-ok">OK</th>
              <th>Producto</th>
              <th class="col-qty">Cant.</th>
              <th>Pedidos</th>
              ${showPesoColumn ? '<th class="col-weight">Peso</th>' : ''}
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
        <script>
          window.onload = function() {
            setTimeout(() => {
              window.print();
              if (window.opener) {
                window.opener.postMessage({ type: 'PRINT_BATCH_SUCCESS', orderIds: ${safeOrderIdsJson} }, '*');
              }
            }, 500);
          };
        </script>
      </body>
    </html>`,
  );
};
