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
            <div style="font-size: 1.2rem;">HOJA DE ARMADO (PICKING)</div>
          </div>
          <div class="order-info">
            <div>Fecha: ${new Date().toLocaleDateString('es-AR')}</div>
            <div class="order-number">#${order.id}</div>
          </div>
        </div>

        <div class="client-box">
          <div class="client-name">${order.client?.name || 'Cliente'}</div>
          <div><strong>Dirección:</strong> ${order.client?.address || 'Retira en local'} ${order.client?.city ? '(' + order.client.city + ')' : ''}</div>
          <div><strong>Notas:</strong> ${order.notes || '-'}</div>
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
            line-height: 1.3; 
            background: #fff;
          }
          .page-block {
            page-break-after: always;
            min-height: 270mm;
            display: flex;
            flex-direction: column;
          }
          .page-block:last-child {
            page-break-after: avoid;
          }

          .header-bar {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 2px solid #111;
            padding-bottom: 6px;
            margin-bottom: 10px;
          }
          .title {
            font-size: 15px;
            font-weight: 800;
            text-transform: uppercase;
          }
          .subtitle {
            font-size: 12px;
            font-weight: 600;
            color: #333;
          }
          .meta-info {
            font-size: 11px;
            text-align: right;
            color: #444;
          }
          
          /* Grilla A4 fija 2x4 por hoja para asegurar máxima legibilidad */
          .orders-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            grid-template-rows: repeat(4, minmax(0, 1fr));
            gap: 10px;
            flex-grow: 1;
          }
          
          .order-card {
            border: 2px solid #222;
            border-radius: 6px;
            padding: 8px 10px;
            background: #fff;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
          }

          .order-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1.5px solid #000;
            padding-bottom: 4px;
            margin-bottom: 4px;
          }

          .order-num {
            font-size: 13px;
            font-weight: 800;
            background: #000;
            color: #fff;
            padding: 2px 7px;
            border-radius: 4px;
          }

          .client-name {
            font-size: 13px;
            font-weight: 800;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            max-width: 200px;
          }

          .order-sub {
            font-size: 10.5px;
            color: #444;
            margin-bottom: 6px;
            font-weight: 600;
          }

          table.item-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 2px;
          }

          table.item-table th {
            font-size: 10px;
            text-transform: uppercase;
            border-bottom: 1.5px solid #222;
            text-align: left;
            padding: 3px 2px;
            color: #111;
            font-weight: 800;
          }

          table.item-table td {
            font-size: 11.5px;
            padding: 4px 2px;
            border-bottom: 1px solid #ddd;
            vertical-align: middle;
          }

          .loc-tag {
            font-size: 9.5px;
            font-weight: 800;
            background: #e2e8f0;
            border: 1px solid #94a3b8;
            padding: 1px 4px;
            border-radius: 3px;
            display: inline-block;
            margin-right: 4px;
          }

          .chk-box {
            width: 16px;
            height: 16px;
            border: 2px solid #000;
            border-radius: 3px;
            display: inline-block;
          }

          /* Agrandado el recuadro para escribir el peso a mano */
          .weight-box {
            width: 58px;
            height: 26px;
            border: 2px dashed #000;
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
                <div class="title">${companyLogo} — HOJA DE ARMADO A4</div>
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

                return `
                  <div class="order-card">
                    <div>
                      <div class="order-header">
                        <span class="order-num">#${order.id}</span>
                        <span class="client-name" title="${clientName}">${clientName}</span>
                      </div>
                      <div class="order-sub">📍 ${address} ${city ? '(' + city + ')' : ''}</div>
                      <table class="item-table">
                        <thead>
                          <tr>
                            <th style="width: 22px; text-align: center;">Visto</th>
                            <th>Artículo / Ubicación</th>
                            <th style="text-align: right; width: 45px;">Cant</th>
                            ${showPesoColumn ? '<th style="text-align: center; width: 65px;">Peso</th>' : ''}
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
                                  <strong style="font-size: 11.5px;">${item.product?.name || 'Artículo'}</strong>
                                </td>
                                <td style="text-align: right; font-weight: 800; font-size: 12.5px;">
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
              if (window.opener) {
                window.opener.postMessage({ type: 'PRINT_BATCH_SUCCESS', orderIds: ${JSON.stringify(processedOrders.map(o => o.id))} }, '*');
              }
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
            <div class="title">${companyLogo} — CONSOLIDADO DE ARMADO (PICKING TOTAL)</div>
            <div class="subtitle">📌 ORDENADO POR DEPOSITO Y UBICACIÓN | ${zoneTitle}</div>
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


