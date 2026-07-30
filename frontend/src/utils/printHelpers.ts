export const printPickingList = (order: any, callback?: () => void) => {
  const printWindow = window.open('', '_blank', 'width=800,height=1000');
  if (!printWindow) return;

  const companyLogo = localStorage.getItem('company_nombre_fantasia') || 'DV DISTRIBUIDORA';

  printWindow.document.write(`
    <html>
      <head>
        <title>Hoja de Armado - Pedido #${order.id}</title>
        <style>
          body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
            padding: 20px; 
            color: #111; 
            font-size: 16px; 
            line-height: 1.5; 
          }
          .header { 
            display: flex; 
            justify-content: space-between;
            align-items: center;
            border-bottom: 2px solid #000;
            padding-bottom: 15px;
            margin-bottom: 20px;
          }
          .logo { font-size: 2rem; font-weight: 800; }
          .order-info { text-align: right; }
          .order-number { font-size: 2.2rem; font-weight: bold; }
          
          .client-box {
            border: 2px solid #333;
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 30px;
            background: #fafafa;
          }
          .client-name { font-size: 1.5rem; font-weight: bold; margin-bottom: 5px; }
          
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th { 
            text-align: left; 
            border-bottom: 2px solid #000; 
            padding: 12px 8px; 
            font-size: 1.1rem;
            text-transform: uppercase;
          }
          td { 
            padding: 15px 8px; 
            border-bottom: 1px solid #ccc;
            font-size: 1.2rem;
            vertical-align: middle;
          }
          .checkbox {
            width: 30px;
            height: 30px;
            border: 2px solid #000;
            border-radius: 4px;
            display: inline-block;
          }
          .weight-box {
            width: 130px;
            height: 45px;
            border: 2px dashed #000;
            border-radius: 4px;
            display: inline-block;
            background: #fff;
          }
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          .bold { font-weight: bold; }
          .pesable-badge {
            font-size: 0.8rem;
            background: #e2e8f0;
            padding: 2px 8px;
            border-radius: 12px;
            margin-left: 8px;
          }
          
          @media print {
            body { -webkit-print-color-adjust: exact; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="logo">${companyLogo}</div>
            <div style="font-size: 1.25rem; font-weight: bold; margin-top: 5px;">Responsable: _________________________</div>
          </div>
          <div class="order-info">
            <div>Fecha: ${new Date().toLocaleDateString('es-AR')}</div>
            <div class="order-number">#${order.id}</div>
          </div>
        </div>

        <div class="client-box">
          <div class="client-name">${order.client?.name || order.persona?.name || 'Cliente'}</div>
          <div><strong>Dirección:</strong> ${order.client?.address || order.persona?.address || 'Retira en local'} ${(order.client?.city || order.persona?.city) ? '(' + (order.client?.city || order.persona?.city) + ')' : ''}</div>
          <div style="margin-top: 8px; padding: 8px 12px; background: ${order.notes ? '#fffbeb' : '#fafafa'}; border: ${order.notes ? '2px solid #f59e0b' : '1px solid #eee'}; border-radius: 6px;">
            <strong style="color: ${order.notes ? '#b45309' : '#111'}; font-size: 1.15rem;">Notas del Vendedor:</strong> 
            <span style="font-size: 1.15rem; font-weight: ${order.notes ? 'bold' : 'normal'}; color: ${order.notes ? '#78350f' : '#555'};">${order.notes || '-'}</span>
          </div>
        </div>

        ${(() => {
          const hasPesables = (order.items || []).some((item: any) => item.product?.isPesable || (item.weight && Number(item.weight) > 0));
          
          return `
            <table>
              <thead>
                <tr>
                  <th style="width: 50px;" class="text-center">Visto</th>
                  <th>Artículo</th>
                  <th class="text-right">Cantidad Solicitada</th>
                  ${hasPesables ? '<th class="text-center" style="width: 160px;">Peso Real (Completar)</th>' : ''}
                </tr>
              </thead>
              <tbody>
                ${order.items.map((item: any) => {
                  const isPesable = item.product?.isPesable || (item.weight && Number(item.weight) > 0);
                  const approxKg = (item.quantity * (item.product?.approximateWeight || 1)).toLocaleString();
                  const cantDisplay = isPesable 
                      ? item.quantity + ' u <span style="font-size: 1rem; color: #555;">(aprox ' + approxKg + ' kg)</span>'
                      : item.quantity + ' u';
                      
                  return '<tr>' +
                      '<td class="text-center"><div class="checkbox"></div></td>' +
                      '<td class="bold">' + (item.product?.name || 'Artículo') + (isPesable ? ' <span class="pesable-badge">Pesable</span>' : '') + '</td>' +
                      '<td class="text-right bold" style="font-size: 1.4rem;">' + cantDisplay + '</td>' +
                      (hasPesables ? '<td class="text-center">' + (isPesable ? '<div class="weight-box"></div>' : '<span style="color: #aaa;">-</span>') + '</td>' : '') +
                    '</tr>';
                }).join('')}
              </tbody>
            </table>
          `;
        })()}
        
        <div style="margin-top: 40px; border-top: 2px dashed #ccc; padding-top: 20px;">
          <div style="display: flex; justify-content: space-between;">
            <div style="width: 45%; border-bottom: 1px solid #000; height: 30px;">Firma Armador:</div>
            <div style="width: 45%; border-bottom: 1px solid #000; height: 30px;">Fecha/Hora Cierre:</div>
          </div>
        </div>

        <script>
          window.onload = function() { 
            setTimeout(() => {
              window.print(); 
              if (${!!callback}) {
                window.opener.postMessage({ type: 'PRINT_SUCCESS', orderId: ${order.id} }, '*');
              }
            }, 500);
          }
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
};

export const printOrderReceipt = (order: any) => {
  const printWindow = window.open('', '_blank', 'width=600,height=800');
  if (!printWindow) return;

  const companyLogo = localStorage.getItem('company_nombre_fantasia') || 'DV DISTRIBUIDORA';
  const companySub = localStorage.getItem('company_razon_social') || 'Mayorista de Alimentos & Bebidas';
  const companyCuitVal = localStorage.getItem('company_cuit') || '30-71717171-9';

  printWindow.document.write(`
    <html>
      <head>
        <title>Comprobante Pedido #${order.id}</title>
        <style>
          body { font-family: monospace; padding: 20px; color: #000; font-size: 13px; line-height: 1.4; }
          .header { text-align: center; margin-bottom: 20px; }
          .logo { font-size: 1.6rem; font-weight: bold; margin-bottom: 4px; }
          .divider { border-top: 1px dashed #000; margin: 12px 0; }
          table { width: 100%; border-collapse: collapse; }
          th { text-align: left; border-bottom: 1px solid #000; padding-bottom: 4px; }
          td { padding: 4px 0; }
          .text-right { text-align: right; }
          .footer { text-align: center; margin-top: 30px; font-size: 0.85rem; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo">${companyLogo}</div>
          <div>${companySub}</div>
          <div>CUIT: ${companyCuitVal}</div>
          <div>Fecha: ${new Date(order.createdAt || Date.now()).toLocaleString('es-AR')}</div>
          <div><strong>PEDIDO NRO: ${order.id}</strong></div>
        </div>
        <div class="divider"></div>
        <div><strong>Cliente:</strong> ${order.client?.name}</div>
        <div><strong>CUIT:</strong> ${order.client?.cuit || 'Consumidor Final'}</div>
        <div><strong>Dirección:</strong> ${order.client?.address || 'Retira en local'}</div>
        <div class="divider"></div>
        <table>
          <thead>
            <tr>
              <th>Articulo</th>
              <th class="text-right">Cant</th>
              <th class="text-right">Unit</th>
              <th class="text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            ${order.items.map((item: any) => {
              const price = Number(item.unitPrice ?? item.price ?? 0);
              const isPesable = item.product?.isPesable || (item.weight && Number(item.weight) > 0);
              const subtotal = item.subtotal ? Number(item.subtotal) : (isPesable ? item.quantity * (item.product?.approximateWeight || 1) * price : item.quantity * price);
              const approxKg = (item.quantity * (item.product?.approximateWeight || 1)).toLocaleString();
              const cantDisplay = isPesable && item.weight ? item.quantity + ' u (' + Number(item.weight).toFixed(2) + ' kg)' : (isPesable ? item.quantity + ' u (' + approxKg + ' kg aprox)' : item.quantity + ' u');
              return '<tr>' +
                  '<td>' + (item.product?.name || 'Artículo') + '</td>' +
                  '<td class="text-right">' + cantDisplay + '</td>' +
                  '<td class="text-right">$' + Math.round(price).toLocaleString('es-AR') + (isPesable ? '/Kg' : '') + '</td>' +
                  '<td class="text-right">$' + Math.round(subtotal).toLocaleString('es-AR') + '</td>' +
                '</tr>';
            }).join('')}
          </tbody>
        </table>
        <div class="divider"></div>
        <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 1.1rem;">
          <span>TOTAL A PAGAR:</span>
          <span>$${Math.round(Number(order.totalAmount)).toLocaleString('es-AR')}</span>
        </div>
        <div style="margin-top: 6px;"><strong>Canal Facturación:</strong> ${order.billingType === 'OFFICIAL' ? 'Sucursal A (Con CAE/AFIP)' : 'Sucursal X (Presupuesto Interno)'}</div>
        <div><strong>Nro Comprobante:</strong> ${order.invoiceNumber || 'No Facturado (Pendiente)'}</div>
        <div class="divider"></div>
        <div class="footer">
          <p>¡Muchas gracias por su compra!</p>
          <p>Para reclamos o logística conserve este ticket</p>
        </div>
        <script>
          window.onload = function() { window.print(); }
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
};

export const printBatchPickingA4 = ({
  orders,
  zone = 'ALL',
  filterLabel = 'General'
}: {
  orders: any[];
  zone?: string;
  filterLabel?: string;
}) => {
  const printWindow = window.open('', '_blank', 'width=1000,height=1200');
  if (!printWindow) return;

  const companyLogo = localStorage.getItem('company_nombre_fantasia') || 'DV DISTRIBUIDORA';

  const getItemZone = (item: any) => item.product?.pickingZone || item.product?.rubro?.pickingZone || 'CAJAS';
  const getItemLocation = (item: any) => item.product?.defaultLocation || item.location || 'S/U';

  // Filter items in orders according to zone
  const processedOrders = orders.map(order => {
    const matchingItems = (order.items || []).filter((item: any) => {
      if (zone === 'ALL') return true;
      return getItemZone(item) === zone;
    });

    return {
      ...order,
      matchingItems
    };
  }).filter(order => order.matchingItems.length > 0);

  const zoneTitle = zone === 'FRIO' ? '❄️ SECTOR FRÍO' : zone === 'TABLA' ? '🍾 SECTOR TABLA/BEBIDAS' : zone === 'CAJAS' ? '📦 SECTOR CAJAS/SECOS' : '🌟 TODAS LAS ZONAS';

  // Determine if peso column should be displayed (Hide for CAJAS and TABLA zones)
  const showPesoColumn = zone === 'FRIO' || (zone === 'ALL' && processedOrders.some(o => o.matchingItems.some((item: any) => item.product?.isPesable || (item.weight && Number(item.weight) > 0))));

  // Divide orders into pages of MAX 8 items per page for optimal legibility
  const MAX_PER_PAGE = 8;
  const pages: any[][] = [];
  for (let i = 0; i < processedOrders.length; i += MAX_PER_PAGE) {
    pages.push(processedOrders.slice(i, i + MAX_PER_PAGE));
  }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Hoja de Armado A4 - ${filterLabel}</title>
        <style>
          @page {
            size: A4 portrait;
            margin: 6mm 6mm 6mm 6mm;
          }
          * {
            box-sizing: border-box;
          }
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; 
            margin: 0;
            padding: 0;
            color: #111; 
            font-size: 11px; 
            line-height: 1.2; 
            background: #fff;
          }
          .page-block {
            page-break-after: always;
            page-break-inside: avoid;
            height: 280mm;
            max-height: 280mm;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            box-sizing: border-box;
          }
          .page-block:last-child {
            page-break-after: avoid;
          }

          .header-bar {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 2px solid #111;
            padding-bottom: 4px;
            margin-bottom: 6px;
            height: 28mm;
            flex-shrink: 0;
          }
          .title {
            font-size: 14px;
            font-weight: 800;
            text-transform: uppercase;
          }
          .subtitle {
            font-size: 11px;
            font-weight: 600;
            color: #333;
          }
          .meta-info {
            font-size: 10.5px;
            text-align: right;
            color: #444;
          }
          
          /* Grilla A4 fija 2x4 por hoja */
          .orders-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            grid-template-rows: repeat(4, 1fr);
            gap: 6px;
            flex-grow: 1;
            height: calc(280mm - 30mm);
            overflow: hidden;
          }
          
          .order-card {
            border: 1.5px solid #222;
            border-radius: 5px;
            padding: 5px 7px;
            background: #fff;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            overflow: hidden;
            page-break-inside: avoid;
            height: 100%;
          }

          .order-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1.5px solid #000;
            padding-bottom: 3px;
            margin-bottom: 3px;
          }

          .order-num {
            font-size: 12px;
            font-weight: 800;
            background: #000;
            color: #fff;
            padding: 1px 6px;
            border-radius: 3px;
          }

          .client-name {
            font-size: 12px;
            font-weight: 800;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            max-width: 180px;
          }

          .order-sub {
            font-size: 10px;
            color: #444;
            margin-bottom: 4px;
            font-weight: 600;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          table.item-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 2px;
          }

          table.item-table th {
            font-size: 9.5px;
            text-transform: uppercase;
            border-bottom: 1.5px solid #222;
            text-align: left;
            padding: 2px 2px;
            color: #111;
            font-weight: 800;
          }

          table.item-table td {
            font-size: 10.5px;
            padding: 2px 2px;
            border-bottom: 1px solid #eee;
            vertical-align: middle;
          }

          .loc-tag {
            font-size: 9px;
            font-weight: 800;
            background: #e2e8f0;
            border: 1px solid #94a3b8;
            padding: 1px 3px;
            border-radius: 3px;
            display: inline-block;
            margin-right: 3px;
          }

          .chk-box {
            width: 14px;
            height: 14px;
            border: 1.5px solid #000;
            border-radius: 2px;
            display: inline-block;
          }

          .weight-box {
            width: 50px;
            height: 22px;
            border: 1.5px dashed #000;
            border-radius: 3px;
            display: inline-block;
            background: #fff;
          }

          @media print {
            body { -webkit-print-color-adjust: exact; }
          }
        </style>
      </head>
      <body>
        ${pages.map((pageOrders, pageIdx) => `
          <div class="page-block">
            <div class="header-bar">
              <div>
                <div class="title">${companyLogo} — Responsable: ________________________</div>
                <div class="subtitle">${zoneTitle} | Filtros: ${filterLabel}</div>
              </div>
              <div class="meta-info">
                <div><strong>Hoja ${pageIdx + 1} de ${pages.length}</strong> (${processedOrders.length} pedidos totales)</div>
                <div><strong>Fecha:</strong> ${new Date().toLocaleDateString('es-AR')} ${new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</div>
              </div>
            </div>

            <div class="orders-grid">
              ${pageOrders.map(order => {
                const clientName = order.client?.name || order.persona?.name || 'Cliente Desconocido';
                const address = order.client?.address || order.persona?.address || 'Retira en Local';
                const city = order.client?.city || order.persona?.city || '';
                const orderNotes = order.notes || (order.bultosDetails?.notes ? order.bultosDetails.notes : '');

                return `
                  <div class="order-card">
                    <div>
                      <div class="order-header">
                        <span class="order-num">#${order.id}</span>
                        <span class="client-name" title="${clientName}">${clientName}</span>
                      </div>
                      <div class="order-sub">📍 ${address} ${city ? '(' + city + ')' : ''}</div>
                      ${orderNotes ? `<div class="order-sub" style="color: #b45309; font-weight: 700; background: #fffbeb; padding: 1px 4px; border-radius: 3px; margin-bottom: 3px;">📝 ${orderNotes}</div>` : ''}
                      <table class="item-table">
                        <thead>
                          <tr>
                            <th style="width: 18px; text-align: center;">✓</th>
                            <th>Artículo / Ubicación</th>
                            <th style="text-align: right; width: 38px;">Cant</th>
                            ${showPesoColumn ? '<th style="text-align: center; width: 50px;">Peso</th>' : ''}
                          </tr>
                        </thead>
                        <tbody>
                          ${order.matchingItems.map((item: any) => {
                            const loc = getItemLocation(item);
                            const isPesable = item.product?.isPesable || (item.weight && Number(item.weight) > 0);
                            
                            return `
                              <tr>
                                <td style="text-align: center;"><div class="chk-box"></div></td>
                                <td>
                                  ${loc !== 'S/U' ? `<span class="loc-tag">${loc}</span>` : ''}
                                  <strong style="font-size: 10px;">${item.product?.name || 'Artículo'}</strong>
                                </td>
                                <td style="text-align: right; font-weight: 800; font-size: 10.5px;">
                                  ${item.quantity}u
                                </td>
                                ${showPesoColumn ? `
                                  <td style="text-align: center;">
                                    ${isPesable ? '<div class="weight-box"></div>' : '<span style="color:#aaa;">-</span>'}
                                  </td>
                                ` : ''}
                              </tr>
                            `;
                          }).join('')}
                        </tbody>
                      </table>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        `).join('')}

        <script>
          window.onload = function() {
            setTimeout(() => {
              window.print();
            }, 500);
          }
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
};

export const printConsolidatedPickingA4 = ({
  orders,
  zone = 'ALL',
  filterLabel = 'General'
}: {
  orders: any[];
  zone?: string;
  filterLabel?: string;
}) => {
  const printWindow = window.open('', '_blank', 'width=1000,height=1200');
  if (!printWindow) return;

  const companyLogo = localStorage.getItem('company_nombre_fantasia') || 'DV DISTRIBUIDORA';

  const getItemZone = (item: any) => item.product?.pickingZone || item.product?.rubro?.pickingZone || 'CAJAS';
  const getItemLocation = (item: any) => item.product?.defaultLocation || item.location || 'S/U';

  // Consolidate all items across matching orders
  const consolidatedMap = new Map<string, {
    productId: string;
    productName: string;
    pickingZone: string;
    location: string;
    isPesable: boolean;
    totalQuantity: number;
    approxWeightTotal: number;
    orderBreakdown: Array<{ orderId: number; clientName: string; quantity: number }>;
  }>();

  orders.forEach(order => {
    (order.items || []).forEach((item: any) => {
      const itemZone = getItemZone(item);
      if (zone !== 'ALL' && itemZone !== zone) return;

      const pId = String(item.productId || item.product?.id || item.product?.name);
      const pName = item.product?.name || 'Artículo Desconocido';
      const loc = getItemLocation(item);
      const isPesable = Boolean(item.product?.isPesable || (item.weight && Number(item.weight) > 0));
      const approxW = Number(item.product?.approximateWeight || 1) * item.quantity;
      const clientName = order.client?.name || order.persona?.name || 'Cliente';

      if (!consolidatedMap.has(pId)) {
        consolidatedMap.set(pId, {
          productId: pId,
          productName: pName,
          pickingZone: itemZone,
          location: loc,
          isPesable,
          totalQuantity: 0,
          approxWeightTotal: 0,
          orderBreakdown: []
        });
      }

      const entry = consolidatedMap.get(pId)!;
      entry.totalQuantity += Number(item.quantity);
      entry.approxWeightTotal += approxW;
      entry.orderBreakdown.push({
        orderId: order.id,
        clientName,
        quantity: item.quantity
      });
    });
  });

  const consolidatedList = Array.from(consolidatedMap.values());

  // Sort consolidated list: Primarily by Picking Zone / Depósito, then by Location, then by Product Name (A-Z)
  consolidatedList.sort((a, b) => {
    // 1. Sort by Zone (FRIO, CAJAS, TABLA)
    if (a.pickingZone !== b.pickingZone) return a.pickingZone.localeCompare(b.pickingZone);
    // 2. Sort by Location (A-01, B-02, etc.)
    if (a.location !== b.location) return a.location.localeCompare(b.location);
    // 3. Sort by Product Name (A-Z)
    return a.productName.localeCompare(b.productName);
  });

  const zoneTitle = zone === 'FRIO' ? '❄️ SECTOR FRÍO' : zone === 'TABLA' ? '🍾 SECTOR TABLA/BEBIDAS' : zone === 'CAJAS' ? '📦 SECTOR CAJAS/SECOS' : '🌟 TODAS LAS ZONAS';

  // Determine if peso column should be displayed (Hide for CAJAS and TABLA zones)
  const showPesoColumn = (zone === 'FRIO' || zone === 'ALL') && consolidatedList.some(item => item.isPesable);

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Consolidado de Armado - ${filterLabel}</title>
        <style>
          @page {
            size: A4 portrait;
            margin: 10mm 10mm 10mm 10mm;
          }
          * {
            box-sizing: border-box;
          }
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; 
            margin: 0;
            padding: 0;
            color: #111; 
            font-size: 12px; 
            line-height: 1.35; 
            background: #fff;
          }
          .header-bar {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 3px solid #111;
            padding-bottom: 8px;
            margin-bottom: 12px;
          }
          .title {
            font-size: 16px;
            font-weight: 800;
            text-transform: uppercase;
          }
          .subtitle {
            font-size: 12px;
            font-weight: 700;
            color: #007AFF;
          }
          .meta-info {
            font-size: 11px;
            text-align: right;
            color: #444;
          }

          table.consolidated-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 6px;
          }

          table.consolidated-table th {
            background: #f1f5f9;
            border: 1.5px solid #334155;
            padding: 7px 8px;
            font-size: 11px;
            text-transform: uppercase;
            font-weight: 800;
            text-align: left;
            color: #0f172a;
          }

          table.consolidated-table td {
            border: 1px solid #cbd5e1;
            padding: 6px 8px;
            font-size: 12px;
            vertical-align: middle;
          }

          .chk-box {
            width: 18px;
            height: 18px;
            border: 2px solid #000;
            border-radius: 3px;
            display: block;
            margin: 0 auto;
          }

          .loc-tag {
            font-size: 10px;
            font-weight: 800;
            background: #e2e8f0;
            border: 1px solid #64748b;
            color: #1e293b;
            padding: 2px 5px;
            border-radius: 3px;
            display: inline-block;
          }

          .zone-tag {
            font-size: 9.5px;
            font-weight: 800;
            background: #dbeafe;
            color: #1e40af;
            padding: 2px 5px;
            border-radius: 3px;
            display: inline-block;
            margin-right: 4px;
          }

          .qty-badge {
            font-size: 14px;
            font-weight: 900;
            color: #0f172a;
            background: #fef08a;
            padding: 2px 8px;
            border-radius: 4px;
            border: 1px solid #eab308;
            display: inline-block;
          }

          .breakdown-list {
            font-size: 11px;
            color: #475569;
            line-height: 1.3;
          }

          /* Agrandado el recuadro para escribir el peso a mano */
          .weight-box {
            width: 65px;
            height: 28px;
            border: 2px dashed #000;
            border-radius: 3px;
            display: block;
            margin: 0 auto;
            background: #fff;
          }

          @media print {
            body { -webkit-print-color-adjust: exact; }
          }
        </style>
      </head>
      <body>
        <div class="header-bar">
          <div>
            <div class="title">${companyLogo} — CONSOLIDADO DE ARMADO</div>
            <div class="subtitle">Responsable: ________________________ | 📌 ORDENADO POR DEPOSITO Y UBICACIÓN | ${zoneTitle}</div>
          </div>
          <div class="meta-info">
            <div><strong>Filtros:</strong> ${filterLabel}</div>
            <div><strong>Lote:</strong> ${orders.length} pedidos | <strong>Productos Distintos:</strong> ${consolidatedList.length}</div>
            <div><strong>Fecha:</strong> ${new Date().toLocaleDateString('es-AR')} ${new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</div>
          </div>
        </div>

        <table class="consolidated-table">
          <thead>
            <tr>
              <th style="width: 32px; text-align: center;">✓</th>
              <th style="width: 140px;">Ubicación / Sector</th>
              <th>Producto</th>
              <th style="width: 100px; text-align: center;">CANT. TOTAL</th>
              <th>Desglose por Pedido</th>
              ${showPesoColumn ? '<th style="width: 85px; text-align: center;">Peso Real</th>' : ''}
            </tr>
          </thead>
          <tbody>
            ${consolidatedList.map(item => {
              const breakdownText = item.orderBreakdown
                .map(b => `<strong>#${b.orderId}</strong> ${b.clientName.split(' ')[0]} (${b.quantity}u)`)
                .join(' • ');

              return `
                <tr>
                  <td style="text-align: center;"><div class="chk-box"></div></td>
                  <td>
                    <span class="zone-tag">${item.pickingZone}</span>
                    <span class="loc-tag">${item.location}</span>
                  </td>
                  <td>
                    <strong style="font-size: 13px;">${item.productName}</strong>
                    ${item.isPesable ? ' <span style="font-size: 10px; background: #fed7aa; color: #9a3412; padding: 1px 5px; border-radius: 3px; font-weight: 700;">Pesable</span>' : ''}
                  </td>
                  <td style="text-align: center;">
                    <span class="qty-badge">${item.totalQuantity} u</span>
                    ${item.isPesable ? `<div style="font-size: 9.5px; color: #64748b; margin-top: 2px;">(aprox ${item.approxWeightTotal.toFixed(1)} kg)</div>` : ''}
                  </td>
                  <td class="breakdown-list">${breakdownText}</td>
                  ${showPesoColumn ? `
                    <td style="text-align: center;">
                      ${item.isPesable ? '<div class="weight-box"></div>' : '<span style="color:#cbd5e1;">-</span>'}
                    </td>
                  ` : ''}
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>

        <script>
          window.onload = function() {
            setTimeout(() => {
              window.print();
              if (window.opener) {
                window.opener.postMessage({ type: 'PRINT_BATCH_SUCCESS', orderIds: ${JSON.stringify(orders.map(o => o.id))} }, '*');
              }
            }, 500);
          }
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
};

export const printShippingLabelsBultos = ({
  orders,
}: {
  orders: any[];
}) => {
  const printWindow = window.open('', '_blank', 'width=600,height=800');
  if (!printWindow) return;

  const companyLogo = localStorage.getItem('company_nombre_fantasia') || 'DISTRIBUIDORA DON VENANCIO';

  const labels: Array<{
    orderId: number;
    clientName: string;
    address: string;
    city: string;
    driverName: string;
    sellerName: string;
    bultoIndex: number;
    totalBultos: number;
    notes: string;
    isPesable: boolean;
  }> = [];

  orders.forEach(order => {
    const bultosCount = Math.max(1, Number(order.bultosCount || 1));
    const clientName = order.client?.name || order.persona?.name || 'Cliente';
    const address = order.client?.address || order.persona?.address || 'Retira en Local';
    const city = order.client?.city || order.persona?.city || '';
    const driverName = order.deliveryRoute?.driverName || 'Reparto General';
    const sellerName = order.seller?.username || 'Vendedor';
    const notes = order.notes || (order.bultosDetails?.notes ? order.bultosDetails.notes : '');
    const isPesable = (order.items || []).some((i: any) => i.product?.isPesable || (i.weight && Number(i.weight) > 0));

    for (let i = 1; i <= bultosCount; i++) {
      labels.push({
        orderId: order.id,
        clientName,
        address,
        city,
        driverName,
        sellerName,
        bultoIndex: i,
        totalBultos: bultosCount,
        notes,
        isPesable,
      });
    }
  });

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Etiquetas de Despacho Térmicas</title>
        <style>
          @page {
            size: 100mm 150mm;
            margin: 0;
          }
          * { box-sizing: border-box; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            padding: 0;
            background: #fff;
            color: #000;
          }
          .label-page {
            width: 100mm;
            height: 145mm;
            padding: 6mm 8mm;
            page-break-after: always;
            page-break-inside: avoid;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            border: 2px solid #000;
          }
          .label-page:last-child {
            page-break-after: avoid;
          }
          .brand-header {
            text-align: center;
            border-bottom: 3px solid #000;
            padding-bottom: 4px;
          }
          .brand-name {
            font-size: 16px;
            font-weight: 900;
            letter-spacing: 0.5px;
            text-transform: uppercase;
          }
          .bulto-badge {
            font-size: 22px;
            font-weight: 900;
            background: #000;
            color: #fff;
            padding: 4px 10px;
            border-radius: 6px;
            text-align: center;
            margin: 8px 0;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .client-box {
            border: 2px solid #000;
            padding: 8px;
            border-radius: 6px;
            margin: 6px 0;
          }
          .client-title {
            font-size: 16px;
            font-weight: 900;
            line-height: 1.1;
            text-transform: uppercase;
          }
          .client-dest {
            font-size: 13px;
            font-weight: 700;
            margin-top: 4px;
          }
          .route-info {
            font-size: 13px;
            font-weight: 800;
            border-top: 2px dashed #000;
            border-bottom: 2px dashed #000;
            padding: 6px 0;
            margin: 6px 0;
          }
          .notes-box {
            background: #f1f5f9;
            border: 1.5px solid #000;
            border-radius: 4px;
            padding: 6px;
            font-size: 12px;
            font-weight: 700;
            margin-top: 4px;
          }
          .footer-code {
            text-align: center;
            font-family: monospace;
            font-size: 14px;
            font-weight: bold;
            letter-spacing: 2px;
            border-top: 2px solid #000;
            padding-top: 4px;
          }
          @media print {
            body { -webkit-print-color-adjust: exact; }
          }
        </style>
      </head>
      <body>
        ${labels.map(lbl => `
          <div class="label-page">
            <div>
              <div class="brand-header">
                <div class="brand-name">${companyLogo}</div>
                <div style="font-size: 11px; font-weight: 800;">RÓTULO OFICIAL DE DESPACHO Y CONTROL</div>
              </div>

              <div class="bulto-badge">
                <span>PEDIDO #${lbl.orderId}</span>
                <span>BULTO ${lbl.bultoIndex} DE ${lbl.totalBultos}</span>
              </div>

              <div class="client-box">
                <div class="client-title">${lbl.clientName}</div>
                <div class="client-dest">📍 ${lbl.address} ${lbl.city ? '(' + lbl.city + ')' : ''}</div>
              </div>

              <div class="route-info">
                <div>🚚 <strong>RUTA / REPARTIDOR:</strong> ${lbl.driverName.toUpperCase()}</div>
                <div>👤 <strong>VENDEDOR:</strong> ${lbl.sellerName.toUpperCase()}</div>
                <div>📅 <strong>FECHA DE CARGA:</strong> ${new Date().toLocaleDateString('es-AR')}</div>
              </div>

              ${lbl.isPesable ? `
                <div style="font-size: 12px; font-weight: 900; background: #000; color: #fff; padding: 4px; text-align: center; border-radius: 4px; margin-top: 4px;">
                  ❄️ CONTIENE ARTÍCULOS PESABLES / FRÍO
                </div>
              ` : ''}

              ${lbl.notes ? `
                <div class="notes-box">
                  ⚠️ <strong>NOTA VENDEDOR:</strong> ${lbl.notes}
                </div>
              ` : ''}
            </div>

            <div>
              <div style="text-align: center; margin-bottom: 4px; font-size: 11px; font-weight: 800;">
                🔒 VERIFICAR FAJA DE SEGURIDAD / CONTROL EN PORTÓN
              </div>
              <div class="footer-code">
                *DV-ORD-${lbl.orderId}-B${lbl.bultoIndex}OF${lbl.totalBultos}*
              </div>
            </div>
          </div>
        `).join('')}

        <script>
          window.onload = function() {
            setTimeout(() => {
              window.print();
            }, 400);
          };
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
};

export const printDeliveryRouteCustodyGuide = (route: any) => {
  const printWindow = window.open('', '_blank', 'width=900,height=1100');
  if (!printWindow) return;

  const companyLogo = localStorage.getItem('company_nombre_fantasia') || 'DISTRIBUIDORA DON VENANCIO';
  const orders = route.orders || [];

  const totalBultosFraccionados = orders.reduce((sum: number, o: any) => sum + Math.max(1, Number(o.bultosCount || 1)), 0);
  const totalCajasTablaEstimadas = orders.reduce((sum: number, o: any) => {
    // Estimación de cajas cerradas de tabla
    const tablaItems = (o.items || []).filter((i: any) => (i.product?.pickingZone === 'TABLA' || i.product?.rubro?.pickingZone === 'TABLA') && !i.product?.isPesable);
    return sum + tablaItems.reduce((acc: number, item: any) => acc + Math.floor(item.quantity / (item.product?.unitsPerBox || 1)), 0);
  }, 0);

  const totalBultosRuta = totalBultosFraccionados + totalCajasTablaEstimadas;

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Guía de Carga y Transferencia de Custodia - Ruta #${route.id}</title>
        <style>
          @page { size: A4 portrait; margin: 10mm; }
          * { box-sizing: border-box; }
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 12px; color: #111; margin: 0; padding: 0; }
          .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #000; padding-bottom: 8px; margin-bottom: 12px; }
          .title { font-size: 18px; font-weight: 900; text-transform: uppercase; }
          .subtitle { font-size: 12px; font-weight: 700; color: #000; }
          .summary-card { border: 2.5px solid #000; border-radius: 8px; padding: 12px; margin-bottom: 16px; background: #fafafa; }
          .summary-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 8px; }
          .category-box { border: 1.5px solid #000; border-radius: 6px; padding: 10px; background: #fff; }
          .category-title { font-size: 11px; font-weight: 900; text-transform: uppercase; margin-bottom: 4px; color: #333; }
          .category-val { font-size: 20px; font-weight: 900; color: #000; }
          table { width: 100%; border-collapse: collapse; margin-top: 12px; }
          th { border: 1.5px solid #000; background: #e2e8f0; padding: 6px 8px; font-size: 11px; text-transform: uppercase; font-weight: 900; text-align: left; }
          td { border: 1px solid #cbd5e1; padding: 6px 8px; font-size: 11.5px; vertical-align: middle; }
          .signature-box { border: 2px solid #000; border-radius: 8px; padding: 16px; margin-top: 24px; background: #fff; }
          @media print { body { -webkit-print-color-adjust: exact; } }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="title">${companyLogo}</div>
            <div class="subtitle">GUÍA DE CARGA Y ACTA OFICIAL DE TRANSFERENCIA DE CUSTODIA</div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 18px; font-weight: 900;">HOJA DE RUTA #${route.id}</div>
            <div>Fecha: ${new Date(route.date || Date.now()).toLocaleDateString('es-AR')}</div>
          </div>
        </div>

        <div class="summary-card">
          <div style="display: flex; justify-content: space-between; font-size: 14px; font-weight: 900; border-bottom: 1.5px solid #000; padding-bottom: 6px;">
            <span>🚚 CHOFER / REPARTIDOR: ${route.driverName.toUpperCase()}${route.companionName ? ` (Acompañante: ${route.companionName.toUpperCase()})` : ''}</span>
            <span>🚙 VEHÍCULO: ${route.vehiclePlate || 'S/D'} ${route.vehicleDescription ? '(' + route.vehicleDescription + ')' : ''}</span>
          </div>

          <div class="summary-grid">
            <div class="category-box">
              <div class="category-title">1. CAJAS CERRADAS FÁBRICA (TABLA)</div>
              <div class="category-val">~ ${totalCajasTablaEstimadas} Cajas</div>
              <div style="font-size: 10.5px; color: #555; margin-top: 2px;">Palletizado sellado de origen (Conteo masivo)</div>
            </div>
            <div class="category-box">
              <div class="category-title">2. BULTOS FRACCIONADOS Y FRÍO (FAJADOS)</div>
              <div class="category-val">${totalBultosFraccionados} Bultos</div>
              <div style="font-size: 10.5px; color: #555; margin-top: 2px;">Cajas abiertas con Faja de Seguridad y Rótulo Térmico</div>
            </div>
          </div>

          <div style="margin-top: 10px; background: #000; color: #fff; padding: 8px 12px; border-radius: 6px; display: flex; justify-content: space-between; align-items: center; font-size: 15px; font-weight: 900;">
            <span>TOTAL ESTIMADO DE BULTOS A CARGAR:</span>
            <span>${totalBultosRuta} BULTOS TOTALES</span>
          </div>
        </div>

        <h4 style="font-size: 13px; font-weight: 900; margin: 16px 0 6px 0; text-transform: uppercase;">Detalle de Pedidos de la Ruta (${orders.length} pedidos)</h4>
        <table>
          <thead>
            <tr>
              <th style="width: 30px; text-align: center;">✓</th>
              <th style="width: 70px;">Pedido</th>
              <th>Cliente y Dirección</th>
              <th style="width: 90px; text-align: center;">Bultos Fajados</th>
              <th>Notas / Observaciones Vendedor</th>
            </tr>
          </thead>
          <tbody>
            ${orders.map((o: any) => `
              <tr>
                <td style="text-align: center;"><div style="width: 16px; height: 16px; border: 1.5px solid #000; margin: 0 auto;"></div></td>
                <td><strong>#${o.id}</strong></td>
                <td>
                  <strong>${o.persona?.name || o.client?.name || 'Cliente'}</strong>
                  <div style="font-size: 10.5px; color: #444;">📍 ${o.persona?.address || o.client?.address || 'Localidad'} ${o.persona?.city || o.client?.city ? '(' + (o.persona?.city || o.client?.city) + ')' : ''}</div>
                </td>
                <td style="text-align: center; font-weight: 900; font-size: 13px;">${o.bultosCount || 1} u</td>
                <td style="font-size: 11px;">${o.notes || o.bultosDetails?.notes || '-'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="signature-box">
          <div style="font-size: 12px; font-weight: 900; text-transform: uppercase; margin-bottom: 6px;">
            🔒 DECLARACIÓN Y TRANSFERENCIA DE CUSTODIA LEGAL DE CARGA
          </div>
          <div style="font-size: 11px; line-height: 1.4; color: #222;">
            Por medio de la presente, el chofer abajo firmante declara haber contado y recibido en perfecta conformidad el total de bultos cerrados y fajados detallados en esta guía. A partir de este momento, asume la responsabilidad total de la custodia y transporte de la mercadería hasta su entrega efectiva al cliente final.
          </div>

          <div style="display: flex; justify-content: space-between; margin-top: 35px; border-top: 1px dashed #000; padding-top: 10px;">
            <div style="width: 45%;">
              <div>________________________________________</div>
              <div style="font-size: 11px; font-weight: 800; margin-top: 3px;">Firma Chofer: ${route.driverName.toUpperCase()}</div>
              <div style="font-size: 10px; color: #555;">DNI / Aclaración:</div>
            </div>
            <div style="width: 45%;">
              <div>________________________________________</div>
              <div style="font-size: 11px; font-weight: 800; margin-top: 3px;">Firma Responsable Despacho / Depósito</div>
              <div style="font-size: 10px; color: #555;">Fecha / Hora Carga: ____/____/2026 ____:____ hs</div>
            </div>
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
    </html>
  `);
  printWindow.document.close();
};




