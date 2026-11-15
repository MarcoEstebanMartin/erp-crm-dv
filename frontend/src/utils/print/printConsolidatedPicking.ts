import {
  PRINT_FONT_STACK,
  escapePrintHtml,
  getPrintCompanyContext,
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
  const { company } = getPrintCompanyContext();
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

  const rowsHtml = consolidatedList
    .map((item) => {
      const breakdownText = item.orderBreakdown
        .map(
          (b) =>
            `<strong>#${b.orderId}</strong> ${escapePrintHtml(b.clientName.split(' ')[0])} (${b.quantity}u)`,
        )
        .join(' &bull; ');
      const approxKgStr = (Number(item.approxWeightScaled) / Number(SCALE)).toFixed(1);

      return `<tr>
        <td style="text-align: center;"><div class="chk-box"></div></td>
        <td>
          <span class="zone-tag">${escapePrintHtml(item.pickingZone)}</span>
          <span class="loc-tag">${escapePrintHtml(item.location)}</span>
        </td>
        <td>
          <strong style="font-size: 13px;">${escapePrintHtml(item.productName)}</strong>
          ${item.isPesable ? ' <span class="pesable-tag">Pesable</span>' : ''}
        </td>
        <td style="text-align: center;">
          <span class="qty-badge">${item.totalQuantity} u</span>
          ${item.isPesable ? `<div style="font-size: 9.5px; color: #4b5563; margin-top: 2px;">(aprox ${approxKgStr} kg)</div>` : ''}
        </td>
        <td class="breakdown-list">${breakdownText}</td>
        ${showPesoColumn ? `<td style="text-align: center;">${item.isPesable ? '<div class="weight-box"></div>' : '<span style="color:#9ca3af;">-</span>'}</td>` : ''}
      </tr>`;
    })
    .join('');

  const safeOrderIdsJson = JSON.stringify(orders.map((o) => Number(o.id) || 0));

  openPrintDocument(
    'width=1000,height=1200',
    `<!DOCTYPE html>
    <html>
      <head>
        <title>Consolidado de Armado - ${escapePrintHtml(filterLabel)}</title>
        <style>
          @page { size: A4 portrait; margin: 10mm; }
          * { box-sizing: border-box; }
          body { font-family: ${PRINT_FONT_STACK}; margin: 0; padding: 0; color: #111827; font-size: 12px; line-height: 1.35; background: #fff; }
          .header-bar { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #111827; padding-bottom: 8px; margin-bottom: 12px; }
          .title { font-size: 16px; font-weight: 800; text-transform: uppercase; }
          .subtitle { font-size: 12px; font-weight: 700; color: #374151; }
          .meta-info { font-size: 11px; text-align: right; color: #374151; }
          table.consolidated-table { width: 100%; border-collapse: collapse; margin-top: 6px; }
          table.consolidated-table th { background: #f3f4f6; border: 1.5px solid #374151; padding: 7px 8px; font-size: 11px; text-transform: uppercase; font-weight: 800; text-align: left; color: #111827; }
          table.consolidated-table td { border: 1px solid #d1d5db; padding: 6px 8px; font-size: 12px; vertical-align: middle; }
          .chk-box { width: 18px; height: 18px; border: 2px solid #111827; border-radius: 3px; display: block; margin: 0 auto; }
          .loc-tag { font-size: 10px; font-weight: 800; background: #f3f4f6; border: 1px solid #9ca3af; color: #111827; padding: 2px 5px; border-radius: 3px; display: inline-block; }
          .zone-tag { font-size: 9.5px; font-weight: 800; background: #111827; color: #ffffff; padding: 2px 5px; border-radius: 3px; display: inline-block; margin-right: 4px; }
          .pesable-tag { font-size: 10px; background: #f3f4f6; border: 1px solid #9ca3af; color: #111827; padding: 1px 5px; border-radius: 3px; font-weight: 700; }
          .qty-badge { font-size: 14px; font-weight: 900; color: #111827; background: #f9fafb; padding: 2px 8px; border-radius: 4px; border: 1.5px solid #111827; display: inline-block; }
          .breakdown-list { font-size: 11px; color: #374151; line-height: 1.3; }
          .weight-box { width: 65px; height: 28px; border: 2px dashed #111827; border-radius: 3px; display: block; margin: 0 auto; background: #fff; }
          @media print { body { -webkit-print-color-adjust: exact; } }
        </style>
      </head>
      <body>
        <div class="header-bar">
          <div>
            <div class="title">${escapePrintHtml(company.nombreFantasia)} — CONSOLIDADO DE ARMADO</div>
            <div class="subtitle">Responsable: ________________________ | ORDENADO POR DEPÓSITO Y UBICACIÓN | ${zoneTitle}</div>
          </div>
          <div class="meta-info">
            <div><strong>Filtros:</strong> ${escapePrintHtml(filterLabel)}</div>
            <div><strong>Lote:</strong> ${orders.length} pedidos | <strong>Productos Distintos:</strong> ${consolidatedList.length}</div>
            <div><strong>Fecha:</strong> ${new Date().toLocaleDateString('es-AR')} ${new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</div>
          </div>
        </div>
        <table class="consolidated-table">
          <thead>
            <tr>
              <th style="width: 32px; text-align: center;">OK</th>
              <th style="width: 140px;">Ubicación / Sector</th>
              <th>Producto</th>
              <th style="width: 100px; text-align: center;">CANT. TOTAL</th>
              <th>Desglose por Pedido</th>
              ${showPesoColumn ? '<th style="width: 85px; text-align: center;">Peso Real</th>' : ''}
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
