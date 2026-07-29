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
            width: 100px;
            height: 35px;
            border: 2px dashed #000;
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

        <table>
          <thead>
            <tr>
              <th style="width: 50px;" class="text-center">Visto</th>
              <th>Artículo</th>
              <th class="text-right">Cantidad Solicitada</th>
              <th class="text-center" style="width: 150px;">Peso Real (Completar)</th>
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
                  '<td class="text-center">' + (isPesable ? '<div class="weight-box"></div>' : '<span style="color: #aaa;">-</span>') + '</td>' +
                '</tr>';
            }).join('')}
          </tbody>
        </table>
        
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

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Hoja de Armado A4 - ${filterLabel}</title>
        <style>
          @page {
            size: A4 portrait;
            margin: 8mm 8mm 8mm 8mm;
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
            line-height: 1.25; 
            background: #fff;
          }
          .header-bar {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 2px solid #111;
            padding-bottom: 6px;
            margin-bottom: 8px;
          }
          .title {
            font-size: 14px;
            font-weight: 800;
            text-transform: uppercase;
          }
          .subtitle {
            font-size: 11px;
            font-weight: 600;
            color: #444;
          }
          .meta-info {
            font-size: 10px;
            text-align: right;
            color: #555;
          }
          
          /* Grilla A4 de 2 columnas compacta */
          .orders-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 6px;
          }
          
          .order-card {
            border: 1.5px solid #222;
            border-radius: 4px;
            padding: 6px 8px;
            background: #fff;
            break-inside: avoid;
            page-break-inside: avoid;
          }

          .order-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1px solid #ccc;
            padding-bottom: 4px;
            margin-bottom: 4px;
          }

          .order-num {
            font-size: 12px;
            font-weight: 800;
            background: #222;
            color: #fff;
            padding: 1px 6px;
            border-radius: 3px;
          }

          .client-name {
            font-size: 11px;
            font-weight: 700;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            max-width: 180px;
          }

          .order-sub {
            font-size: 9.5px;
            color: #555;
            margin-bottom: 4px;
          }

          table.item-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 2px;
          }

          table.item-table th {
            font-size: 9px;
            text-transform: uppercase;
            border-bottom: 1px solid #222;
            text-align: left;
            padding: 2px 2px;
            color: #333;
          }

          table.item-table td {
            font-size: 10px;
            padding: 3px 2px;
            border-bottom: 1px solid #eee;
            vertical-align: middle;
          }

          .loc-tag {
            font-size: 8.5px;
            font-weight: 700;
            background: #f0f0f0;
            border: 1px solid #ccc;
            padding: 1px 3px;
            border-radius: 2px;
            display: inline-block;
            margin-right: 4px;
          }

          .chk-box {
            width: 14px;
            height: 14px;
            border: 1.5px solid #000;
            border-radius: 2px;
            display: inline-block;
          }

          .weight-box {
            width: 32px;
            height: 14px;
            border: 1px dashed #000;
            display: inline-block;
          }

          @media print {
            body { -webkit-print-color-adjust: exact; }
          }
        </style>
      </head>
      <body>
        <div class="header-bar">
          <div>
            <div class="title">${companyLogo} — HOJA DE ARMADO A4</div>
            <div class="subtitle">${zoneTitle} | Filtros: ${filterLabel}</div>
          </div>
          <div class="meta-info">
            <div><strong>Pedidos:</strong> ${processedOrders.length}</div>
            <div><strong>Fecha:</strong> ${new Date().toLocaleDateString('es-AR')} ${new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</div>
          </div>
        </div>

        <div class="orders-grid">
          ${processedOrders.map(order => {
            const clientName = order.client?.name || order.persona?.name || 'Cliente Desconocido';
            const address = order.client?.address || order.persona?.address || 'Retira en Local';
            const city = order.client?.city || order.persona?.city || '';

            return `
              <div class="order-card">
                <div class="order-header">
                  <span class="order-num">#${order.id}</span>
                  <span class="client-name" title="${clientName}">${clientName}</span>
                </div>
                <div class="order-sub">📍 ${address} ${city ? '(' + city + ')' : ''}</div>
                <table class="item-table">
                  <thead>
                    <tr>
                      <th style="width: 18px;">Visto</th>
                      <th>Artículo / Ubicación</th>
                      <th style="text-align: right; width: 35px;">Cant</th>
                      <th style="text-align: center; width: 35px;">Peso</th>
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
                            <strong>${item.product?.name || 'Artículo'}</strong>
                          </td>
                          <td style="text-align: right; font-weight: 700; font-size: 11px;">
                            ${item.quantity}u
                          </td>
                          <td style="text-align: center;">
                            ${isPesable ? '<div class="weight-box"></div>' : '<span style="color:#ccc;">-</span>'}
                          </td>
                        </tr>
                      `;
                    }).join('')}
                  </tbody>
                </table>
              </div>
            `;
          }).join('')}
        </div>

        <script>
          window.onload = function() {
            setTimeout(() => {
              window.print();
            }, 300);
          }
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
};

