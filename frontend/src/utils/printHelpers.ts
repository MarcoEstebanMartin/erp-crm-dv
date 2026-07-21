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
