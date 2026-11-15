import {
  computeFallbackItemSubtotalPrint,
  escapePrintHtml,
  formatArsPrint,
  getPrintCompanyContext,
  openPrintDocument,
  resolvePrintClientMeta,
  roundIntPesoPrint,
} from '../../utils/print/printFormatters';

export function printOrderTicket(order: any): void {
  const { company, phone } = getPrintCompanyContext();
  const client = resolvePrintClientMeta(order);
  const clientAddress = client.persona?.address
    ? `${client.persona.address}${client.city ? ` (${client.city})` : ''}`
    : client.city || 'Retira en local';
  const hasBalance = client.persona?.outstandingBalance != null;
  const previousBalance = roundIntPesoPrint(client.outstandingBalance);

  const itemsHtml = (order.items || [])
    .map((item: any) => {
      const price = roundIntPesoPrint(item.unitPrice ?? item.price ?? 0);
      const isPesable = Boolean(
        item.product?.isPesable || (item.weight && Number(item.weight) > 0),
      );
      const subtotal = computeFallbackItemSubtotalPrint(item);
      const cantDisplay =
        isPesable && item.weight
          ? `${item.quantity} u (${Number(item.weight).toFixed(2)} kg)`
          : isPesable
            ? `${item.quantity} u (${(Number(item.quantity || 0) * Number(item.product?.approximateWeight || 1)).toLocaleString('es-AR')} kg aprox)`
            : `${item.quantity} u`;

      return `<tr>
        <td>${escapePrintHtml(item.product?.name || 'Artículo')}</td>
        <td class="text-right">${cantDisplay}</td>
        <td class="text-right">$${formatArsPrint(price)}${isPesable ? '/Kg' : ''}</td>
        <td class="text-right">$${formatArsPrint(subtotal)}</td>
      </tr>`;
    })
    .join('');

  openPrintDocument(
    'width=600,height=800',
    `<!DOCTYPE html>
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
          <div class="logo">${escapePrintHtml(company.nombreFantasia)}</div>
          <div>${escapePrintHtml(company.razonSocial)}</div>
          ${company.direccion ? `<div>${escapePrintHtml(company.direccion)}</div>` : ''}
          <div>CUIT: ${escapePrintHtml(company.cuit)}${phone ? ` · Tel: ${escapePrintHtml(phone)}` : ''}</div>
          <div>Fecha: ${new Date(order.createdAt || Date.now()).toLocaleString('es-AR')}</div>
          <div><strong>PEDIDO NRO: ${order.id}</strong></div>
        </div>
        <div class="divider"></div>
        <div><strong>Cliente:</strong> ${escapePrintHtml(client.name)}</div>
        <div><strong>CUIT:</strong> ${escapePrintHtml(client.cuit)}</div>
        <div><strong>Dirección:</strong> ${escapePrintHtml(clientAddress)}</div>
        ${hasBalance ? `<div><strong>Saldo Cta. Cte.:</strong> $${previousBalance.toLocaleString('es-AR')}</div>` : ''}
        <div class="divider"></div>
        <table>
          <thead>
            <tr>
              <th>Artículo</th>
              <th class="text-right">Cant</th>
              <th class="text-right">Unit</th>
              <th class="text-right">Total</th>
            </tr>
          </thead>
          <tbody>${itemsHtml}</tbody>
        </table>
        <div class="divider"></div>
        <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 1.1rem;">
          <span>TOTAL A PAGAR:</span>
          <span>$${formatArsPrint(order.totalAmount)}</span>
        </div>
        <div style="margin-top: 6px;"><strong>Canal Facturación:</strong> ${order.billingType === 'OFFICIAL' ? 'Sucursal A (Con CAE/AFIP)' : 'Sucursal X (Presupuesto Interno)'}</div>
        <div><strong>Nro Comprobante:</strong> ${escapePrintHtml(order.invoiceNumber || 'No Facturado (Pendiente)')}</div>
        <div class="divider"></div>
        <div class="footer">
          <p>¡Muchas gracias por su compra!</p>
          <p>Para reclamos o logística conserve este ticket</p>
        </div>
        <script>
          window.onload = function() { window.print(); };
        </script>
      </body>
    </html>`,
  );
}
