import {
  PRINT_FONT_STACK,
  escapePrintHtml,
  getPrintCompanyContext,
  getZoneDisplayTitle,
  openPrintDocument,
  resolvePrintClientMeta,
} from './printFormatters';

export const printPickingList = (order: any, callback?: () => void) => {
  const { company } = getPrintCompanyContext();
  const client = resolvePrintClientMeta(order);
  const items = order.items || [];
  const hasPesables = items.some(
    (item: any) => item.product?.isPesable || (item.weight && Number(item.weight) > 0),
  );
  const safeOrderId = Number(order.id) || 0;

  const rowsHtml = items
    .map((item: any) => {
      const isPesable = item.product?.isPesable || (item.weight && Number(item.weight) > 0);
      const approxKg = (Number(item.quantity || 0) * Number(item.product?.approximateWeight || 1)).toLocaleString('es-AR');
      const cantDisplay = isPesable
        ? `${item.quantity} u <span style="font-size: 1rem; color: #4b5563;">(aprox ${approxKg} kg)</span>`
        : `${item.quantity} u`;

      return `<tr>
        <td class="text-center"><div class="checkbox"></div></td>
        <td class="bold">${escapePrintHtml(item.product?.name || 'Artículo')}${isPesable ? ' <span class="pesable-badge">Pesable</span>' : ''}</td>
        <td class="text-right bold" style="font-size: 1.4rem;">${cantDisplay}</td>
        ${hasPesables ? `<td class="text-center">${isPesable ? '<div class="weight-box"></div>' : '<span style="color: #9ca3af;">-</span>'}</td>` : ''}
      </tr>`;
    })
    .join('');

  openPrintDocument(
    'width=800,height=1000',
    `<!DOCTYPE html>
    <html>
      <head>
        <title>Hoja de Armado - Pedido #${safeOrderId}</title>
        <style>
          body { font-family: ${PRINT_FONT_STACK}; padding: 20px; color: #111827; font-size: 16px; line-height: 1.5; }
          .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #111827; padding-bottom: 15px; margin-bottom: 20px; }
          .logo { font-size: 2rem; font-weight: 800; }
          .order-info { text-align: right; }
          .order-number { font-size: 2.2rem; font-weight: bold; }
          .client-box { border: 2px solid #1f2937; padding: 15px; border-radius: 8px; margin-bottom: 30px; background: #f9fafb; }
          .client-name { font-size: 1.5rem; font-weight: bold; margin-bottom: 5px; }
          .notes-box { margin-top: 8px; padding: 8px 12px; background: #ffffff; border: 1.5px solid ${order.notes ? '#111827' : '#e5e7eb'}; border-radius: 6px; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th { text-align: left; border-bottom: 2px solid #111827; padding: 12px 8px; font-size: 1.05rem; text-transform: uppercase; }
          td { padding: 15px 8px; border-bottom: 1px solid #d1d5db; font-size: 1.15rem; vertical-align: middle; }
          .checkbox { width: 30px; height: 30px; border: 2px solid #111827; border-radius: 4px; display: inline-block; }
          .weight-box { width: 130px; height: 45px; border: 2px dashed #111827; border-radius: 4px; display: inline-block; background: #fff; }
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          .bold { font-weight: bold; }
          .pesable-badge { font-size: 0.78rem; background: #f3f4f6; border: 1px solid #d1d5db; padding: 2px 8px; border-radius: 4px; margin-left: 8px; }
          @media print { body { -webkit-print-color-adjust: exact; } }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="logo">${escapePrintHtml(company.nombreFantasia)}</div>
            <div style="font-size: 1.2rem; font-weight: bold; margin-top: 5px;">Responsable: _________________________</div>
          </div>
          <div class="order-info">
            <div>Fecha: ${new Date().toLocaleDateString('es-AR')}</div>
            <div class="order-number">#${safeOrderId}</div>
          </div>
        </div>
        <div class="client-box">
          <div class="client-name">${escapePrintHtml(client.name)}</div>
          <div><strong>Dirección:</strong> ${escapePrintHtml(client.address)}${client.city ? ` (${escapePrintHtml(client.city)})` : ''}</div>
          <div class="notes-box">
            <strong style="color: #111827; font-size: 1.05rem;">Notas del Vendedor:</strong>
            <span style="font-size: 1.05rem; font-weight: ${order.notes ? 'bold' : 'normal'}; color: #374151;">${escapePrintHtml(order.notes || '-')}</span>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th style="width: 50px;" class="text-center">Visto</th>
              <th>Artículo</th>
              <th class="text-right">Cantidad Solicitada</th>
              ${hasPesables ? '<th class="text-center" style="width: 160px;">Peso Real (Completar)</th>' : ''}
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
        <div style="margin-top: 40px; border-top: 2px dashed #9ca3af; padding-top: 20px;">
          <div style="display: flex; justify-content: space-between;">
            <div style="width: 45%; border-bottom: 1px solid #111827; height: 30px;">Firma Armador:</div>
            <div style="width: 45%; border-bottom: 1px solid #111827; height: 30px;">Fecha/Hora Cierre:</div>
          </div>
        </div>
        <script>
          window.onload = function() {
            setTimeout(() => {
              window.print();
              if (${Boolean(callback)} && window.opener) {
                window.opener.postMessage({ type: 'PRINT_SUCCESS', orderId: ${safeOrderId} }, '*');
              }
            }, 500);
          };
        </script>
      </body>
    </html>`,
  );
};

export const printBatchPickingA4 = ({
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

  const processedOrders = orders
    .map((order) => ({
      ...order,
      matchingItems: (order.items || []).filter((item: any) =>
        zone === 'ALL' ? true : getItemZone(item) === zone,
      ),
    }))
    .filter((order) => order.matchingItems.length > 0);

  const zoneTitle = getZoneDisplayTitle(zone);
  const showPesoColumn =
    zone === 'FRIO' ||
    (zone === 'ALL' &&
      processedOrders.some((o) =>
        o.matchingItems.some(
          (item: any) => item.product?.isPesable || (item.weight && Number(item.weight) > 0),
        ),
      ));

  const MAX_PER_PAGE = 8;
  const pages: any[][] = [];
  for (let i = 0; i < processedOrders.length; i += MAX_PER_PAGE) {
    pages.push(processedOrders.slice(i, i + MAX_PER_PAGE));
  }

  const pagesHtml = pages
    .map(
      (pageOrders, pageIdx) => `
      <div class="page-block">
        <div class="header-bar">
          <div>
            <div class="title">${escapePrintHtml(company.nombreFantasia)} — Responsable: ________________________</div>
            <div class="subtitle">${zoneTitle} | Filtros: ${escapePrintHtml(filterLabel)}</div>
          </div>
          <div class="meta-info">
            <div><strong>Hoja ${pageIdx + 1} de ${pages.length}</strong> (${processedOrders.length} pedidos totales)</div>
            <div><strong>Fecha:</strong> ${new Date().toLocaleDateString('es-AR')} ${new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</div>
          </div>
        </div>
        <div class="orders-grid">
          ${pageOrders
            .map((order) => {
              const client = resolvePrintClientMeta(order);
              const orderNotes = order.notes || order.bultosDetails?.notes || '';
              return `<div class="order-card">
                <div>
                  <div class="order-header">
                    <span class="order-num">#${order.id}</span>
                    <span class="client-name" title="${escapePrintHtml(client.name)}">${escapePrintHtml(client.name)}</span>
                  </div>
                  <div class="order-sub">Dir: ${escapePrintHtml(client.address)}${client.city ? ` (${escapePrintHtml(client.city)})` : ''}</div>
                  ${orderNotes ? `<div class="order-notes">Nota: ${escapePrintHtml(orderNotes)}</div>` : ''}
                  <table class="item-table">
                    <thead>
                      <tr>
                        <th style="width: 22px; text-align: center;">OK</th>
                        <th>Artículo / Ubicación</th>
                        <th style="text-align: right; width: 38px;">Cant</th>
                        ${showPesoColumn ? '<th style="text-align: center; width: 50px;">Peso</th>' : ''}
                      </tr>
                    </thead>
                    <tbody>
                      ${order.matchingItems
                        .map((item: any) => {
                          const loc = getItemLocation(item);
                          const isPesable =
                            item.product?.isPesable || (item.weight && Number(item.weight) > 0);
                          return `<tr>
                            <td style="text-align: center;"><div class="chk-box"></div></td>
                            <td>
                              ${loc !== 'S/U' ? `<span class="loc-tag">${escapePrintHtml(loc)}</span>` : ''}
                              <strong style="font-size: 10px;">${escapePrintHtml(item.product?.name || 'Artículo')}</strong>
                            </td>
                            <td style="text-align: right; font-weight: 800; font-size: 10.5px;">${item.quantity}u</td>
                            ${showPesoColumn ? `<td style="text-align: center;">${isPesable ? '<div class="weight-box"></div>' : '<span style="color:#9ca3af;">-</span>'}</td>` : ''}
                          </tr>`;
                        })
                        .join('')}
                    </tbody>
                  </table>
                </div>
              </div>`;
            })
            .join('')}
        </div>
      </div>`,
    )
    .join('');

  openPrintDocument(
    'width=1000,height=1200',
    `<!DOCTYPE html>
    <html>
      <head>
        <title>Hoja de Armado A4 - ${escapePrintHtml(filterLabel)}</title>
        <style>
          @page { size: A4 portrait; margin: 6mm; }
          * { box-sizing: border-box; }
          body { font-family: ${PRINT_FONT_STACK}; margin: 0; padding: 0; color: #111827; font-size: 11px; line-height: 1.2; background: #fff; }
          .page-block { page-break-after: always; page-break-inside: avoid; height: 280mm; max-height: 280mm; overflow: hidden; display: flex; flex-direction: column; }
          .page-block:last-child { page-break-after: avoid; }
          .header-bar { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #111827; padding-bottom: 4px; margin-bottom: 6px; height: 28mm; flex-shrink: 0; }
          .title { font-size: 14px; font-weight: 800; text-transform: uppercase; }
          .subtitle { font-size: 11px; font-weight: 600; color: #374151; }
          .meta-info { font-size: 10.5px; text-align: right; color: #374151; }
          .orders-grid { display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: repeat(4, 1fr); gap: 6px; flex-grow: 1; height: calc(280mm - 30mm); overflow: hidden; }
          .order-card { border: 1.5px solid #111827; border-radius: 5px; padding: 5px 7px; background: #fff; display: flex; flex-direction: column; justify-content: space-between; overflow: hidden; page-break-inside: avoid; height: 100%; }
          .order-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1.5px solid #111827; padding-bottom: 3px; margin-bottom: 3px; }
          .order-num { font-size: 12px; font-weight: 800; background: #111827; color: #fff; padding: 1px 6px; border-radius: 3px; }
          .client-name { font-size: 12px; font-weight: 800; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 180px; }
          .order-sub { font-size: 10px; color: #374151; margin-bottom: 4px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
          .order-notes { font-size: 10px; color: #111827; font-weight: 700; background: #f3f4f6; border-left: 2px solid #111827; padding: 2px 5px; margin-bottom: 3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
          table.item-table { width: 100%; border-collapse: collapse; margin-top: 2px; }
          table.item-table th { font-size: 9px; text-transform: uppercase; border-bottom: 1.5px solid #111827; text-align: left; padding: 2px; color: #111827; font-weight: 800; }
          table.item-table td { font-size: 10.5px; padding: 2px; border-bottom: 1px solid #e5e7eb; vertical-align: middle; }
          .loc-tag { font-size: 9px; font-weight: 800; background: #f3f4f6; border: 1px solid #9ca3af; padding: 1px 3px; border-radius: 3px; display: inline-block; margin-right: 3px; }
          .chk-box { width: 14px; height: 14px; border: 1.5px solid #111827; border-radius: 2px; display: inline-block; }
          .weight-box { width: 50px; height: 22px; border: 1.5px dashed #111827; border-radius: 3px; display: inline-block; background: #fff; }
          @media print { body { -webkit-print-color-adjust: exact; } }
        </style>
      </head>
      <body>
        ${pagesHtml}
        <script>
          window.onload = function() {
            setTimeout(() => { window.print(); }, 500);
          };
        </script>
      </body>
    </html>`,
  );
};
