export const getQuickItemPrice = (product: any, client: any) => {
  if (!client) return Math.round(Number(product.listPrice));
  let price = Number(product.listPrice);
  if (client.priceList === 'B') {
    price = Number(product.listPriceB) > 0 ? Number(product.listPriceB) : Number(product.listPrice);
  } else if (client.priceList === 'C') {
    price = Number(product.listPriceC) > 0 ? Number(product.listPriceC) : Number(product.listPrice);
  }

  let discount = Number(client.discount || 0);
  const isQuesoRemottiOrMelincue =
    product.rubro?.name === 'REMOTTI' ||
    product.description?.toUpperCase() === 'REMOTTI' ||
    product.name?.toUpperCase().includes('REMOTTI') ||
    product.description?.toUpperCase() === 'MELINCUE' ||
    product.name?.toUpperCase().includes('MELINCUE');

  const isFanberlian = client.name?.toUpperCase().includes('FANBERLIAN');
  if (isFanberlian) {
    discount = isQuesoRemottiOrMelincue ? 3 : 4;
  } else if (client.priceList === 'ESPECIAL_QUESOS') {
    discount = isQuesoRemottiOrMelincue ? 3 : 0;
  } else if (client.priceList === 'B') {
    const isMelincue = product.description?.toUpperCase() === 'MELINCUE' || product.name?.toUpperCase().includes('MELINCUE');
    discount = isMelincue ? 3 : 0;
  }

  return Math.round(price * (1 - discount / 100));
};

export const printOrderTicket = (order: any) => {
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
        <div><strong>Cliente:</strong> ${order.client?.name || order.persona?.name || 'Cliente'}</div>
        <div><strong>CUIT:</strong> ${order.client?.cuit || order.persona?.cuit || 'Consumidor Final'}</div>
        <div><strong>Dirección:</strong> ${order.client?.address || order.persona?.address || 'Retira en local'}</div>
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
            ${order.items
              .map((item: any) => {
                const price = Number(item.unitPrice ?? item.price ?? 0);
                const isPesable = item.product?.isPesable || (item.weight && Number(item.weight) > 0);
                const subtotal = item.subtotal
                  ? Number(item.subtotal)
                  : isPesable
                    ? item.quantity * (item.product?.approximateWeight || 1) * price
                    : item.quantity * price;
                const cantDisplay =
                  isPesable && item.weight
                    ? `${item.quantity} u (${Number(item.weight).toFixed(2)} kg)`
                    : isPesable
                      ? `${item.quantity} u (${(item.quantity * (item.product?.approximateWeight || 1)).toLocaleString()} kg aprox)`
                      : `${item.quantity} u`;
                return `
                  <tr>
                    <td>${item.product?.name || 'Artículo'}</td>
                    <td class="text-right">${cantDisplay}</td>
                    <td class="text-right">$${Math.round(price).toLocaleString('es-AR')}${isPesable ? '/Kg' : ''}</td>
                    <td class="text-right">$${Math.round(subtotal).toLocaleString('es-AR')}</td>
                  </tr>
                `;
              })
              .join('')}
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
