import {
  PRINT_FONT_STACK,
  computeFallbackItemSubtotalPrint,
  escapePrintHtml,
  formatArsPrint,
  getPrintCompanyContext,
  openPrintDocument,
  resolvePrintClientMeta,
  roundIntPesoPrint,
} from './printFormatters';

export { printFacturaOficialA4 } from '../printFacturaOficialA4';

function formatRemitoBultosLabel(items: any[]): string {
  let totalCajas = 0;
  let totalSueltos = 0;

  items.forEach((it: any) => {
    const qty = Number(it.quantity || 0);
    const unitsPerBox =
      it.product?.unitsPerBox && Number(it.product.unitsPerBox) > 1
        ? Number(it.product.unitsPerBox)
        : 1;

    if (unitsPerBox > 1) {
      totalCajas += Math.floor(qty / unitsPerBox);
      totalSueltos += qty % unitsPerBox;
    } else {
      totalSueltos += qty;
    }
  });

  const formattedSueltos = totalSueltos % 1 === 0 ? totalSueltos : totalSueltos.toFixed(2);
  if (totalCajas > 0 && totalSueltos > 0) {
    return `Cajas: ${totalCajas} &nbsp;&bull;&nbsp; Unidades sueltas: ${formattedSueltos}`;
  }
  if (totalCajas > 0) return `Cajas cerradas: ${totalCajas}`;
  return `Unidades: ${formattedSueltos}`;
}

export const printRemitoX = (order: any) => {
  const { company, phone } = getPrintCompanyContext();
  const client = resolvePrintClientMeta(order);
  const remitoDateValue = order.invoicedAt || order.createdAt;
  const formattedDate = remitoDateValue
    ? new Date(remitoDateValue).toLocaleDateString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    : new Date().toLocaleDateString('es-AR');

  const formattedDueDate = order.dueDate
    ? new Date(order.dueDate).toLocaleDateString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    : formattedDate;

  const remitoNum = order.remitoNumber || `0001-${String(order.id).padStart(8, '0')}`;
  const items = order.items || order.orderItems || [];
  const bultosLabel = formatRemitoBultosLabel(items);

  const rowsHtml =
    items.length > 0
      ? items
          .map((it: any) => {
            const cant = Number(it.quantity || 0);
            const weightKg = Number(it.weight || 0);
            const price = roundIntPesoPrint(it.unitPrice ?? it.price ?? 0);
            const subtotal = computeFallbackItemSubtotalPrint(it);
            const name = escapePrintHtml(it.product?.name || it.name || 'Producto');
            const cantDisplay =
              weightKg > 0
                ? `${weightKg.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 3 })} kg`
                : `${cant}`;
            return `
              <tr>
                <td class="text-center mono font-bold">${cantDisplay}</td>
                <td><strong>${name}</strong></td>
                <td class="text-right mono">$ ${formatArsPrint(price)}</td>
                <td class="text-right mono font-bold">$ ${formatArsPrint(subtotal)}</td>
              </tr>`;
          })
          .join('')
      : `<tr><td colspan="4" class="text-center" style="padding: 20px; color: #6b7280;">Sin ítems registrados</td></tr>`;

  openPrintDocument(
    'width=900,height=1100',
    `<!DOCTYPE html>
    <html>
      <head>
        <title>Remito X - N° ${escapePrintHtml(remitoNum)}</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: ${PRINT_FONT_STACK}; color: #111827; background: #ffffff; padding: 24px; font-size: 12px; line-height: 1.4; }
          .remito-card { border: 1px solid #d1d5db; border-radius: 8px; overflow: hidden; background: #ffffff; min-height: 255mm; display: flex; flex-direction: column; justify-content: space-between; }
          .legal-banner { background: #f9fafb; border-bottom: 1px solid #d1d5db; padding: 6px 16px; text-align: center; font-weight: 700; font-size: 11px; letter-spacing: 0.05em; color: #111827; }
          .header-main { display: flex; align-items: stretch; border-bottom: 1px solid #d1d5db; }
          .header-left { flex: 1.2; padding: 16px 20px; border-right: 1px solid #d1d5db; }
          .company-sub { font-size: 11px; color: #4b5563; margin-top: 4px; font-weight: 500; }
          .header-right { flex: 1; padding: 16px 20px; display: flex; flex-direction: column; justify-content: center; background: #ffffff; }
          .doc-title { font-size: 16px; font-weight: 800; color: #111827; letter-spacing: 0.04em; }
          .doc-meta { margin-top: 4px; font-size: 11px; color: #374151; }
          .doc-meta strong { color: #111827; }
          .info-grid { display: flex; border-bottom: 1px solid #d1d5db; }
          .client-block { flex: 1.4; padding: 14px 20px; border-right: 1px solid #d1d5db; }
          .sale-block { flex: 1; padding: 14px 20px; background: #f9fafb; }
          .block-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280; margin-bottom: 6px; }
          .client-title { font-size: 14px; font-weight: 700; color: #111827; }
          .info-row { display: flex; justify-content: space-between; margin-top: 4px; font-size: 11px; color: #374151; }
          .table-container { width: 100%; flex: 1; }
          table { width: 100%; border-collapse: collapse; }
          th { background: #f3f4f6; color: #111827; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; padding: 10px 14px; text-align: left; border-bottom: 1px solid #d1d5db; }
          td { padding: 10px 14px; border-bottom: 1px solid #e5e7eb; font-size: 11px; color: #111827; }
          .text-right { text-align: right; }
          .text-center { text-align: center; }
          .mono { font-family: 'JetBrains Mono', ui-monospace, monospace; font-weight: 500; }
          .font-bold { font-weight: 700; }
          .summary-bar { display: flex; justify-content: space-between; align-items: center; padding: 14px 20px; background: #f9fafb; border-top: 1px solid #d1d5db; margin-top: auto; }
          .bultos-badge { font-size: 11px; font-weight: 700; color: #374151; background: #e5e7eb; padding: 4px 12px; border-radius: 20px; }
          .total-box { font-size: 16px; font-weight: 800; color: #111827; display: flex; align-items: center; gap: 12px; }
          .total-amount { font-family: 'JetBrains Mono', ui-monospace, monospace; font-size: 18px; font-weight: 700; color: #111827; }
          @media print {
            body { padding: 0; background: #fff; }
            .remito-card { border: 1px solid #000; border-radius: 0; min-height: 270mm; }
            th { background: #f3f4f6 !important; color: #000 !important; }
            @page { size: A4 portrait; margin: 10mm; }
          }
        </style>
      </head>
      <body>
        <div class="remito-card">
          <div>
            <div class="legal-banner">DOCUMENTO NO VÁLIDO COMO FACTURA</div>
            <div class="header-main">
              <div class="header-left">
                <img src="${window.location.origin}/logo.png" alt="${escapePrintHtml(company.nombreFantasia)}" style="max-height: 52px; max-width: 190px; object-fit: contain; margin-bottom: 4px;" />
                <div class="company-sub">${escapePrintHtml(company.razonSocial)}</div>
                <div class="company-sub">${escapePrintHtml(company.direccion)}${phone ? ` &nbsp;|&nbsp; Tel: ${escapePrintHtml(phone)}` : ''}</div>
              </div>
              <div class="header-right">
                <div class="doc-title">REMITO N° ${escapePrintHtml(remitoNum)}</div>
                <div class="doc-meta"><strong>Fecha de Emisión:</strong> ${formattedDate}</div>
                <div class="doc-meta"><strong>Vencimiento:</strong> ${formattedDueDate}</div>
              </div>
            </div>
            <div class="info-grid">
              <div class="client-block">
                <div class="block-label">Cliente</div>
                <div class="client-title">${escapePrintHtml(client.name)}</div>
                <div class="info-row"><span><strong>Dirección:</strong> ${escapePrintHtml(client.address)}</span><span><strong>Localidad:</strong> ${escapePrintHtml(client.city || 'S/D')}</span></div>
                <div class="info-row"><span><strong>Categoría IVA:</strong> ${escapePrintHtml(client.taxCondition)}</span><span><strong>CUIT / DNI:</strong> ${escapePrintHtml(client.cuit)}</span></div>
              </div>
              <div class="sale-block">
                <div class="block-label">Condición Comercial</div>
                <div class="info-row"><span><strong>Forma de Pago:</strong> ${escapePrintHtml(order.paymentMethod || 'CUENTA CORRIENTE')}</span></div>
                <div class="info-row"><span><strong>Saldo Anterior:</strong> $ ${formatArsPrint(client.outstandingBalance)}</span></div>
              </div>
            </div>
            <div class="table-container">
              <table>
                <thead>
                  <tr>
                    <th style="width: 10%;" class="text-center">Cant.</th>
                    <th style="width: 60%;">PRODUCTO / DETALLE</th>
                    <th style="width: 15%;" class="text-right">Precio Unit.</th>
                    <th style="width: 15%;" class="text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody>${rowsHtml}</tbody>
              </table>
            </div>
          </div>
          <div class="summary-bar">
            <div class="bultos-badge">${bultosLabel}</div>
            <div class="total-box">
              <span>TOTAL:</span>
              <span class="total-amount">$ ${formatArsPrint(order.totalAmount || 0)}</span>
            </div>
          </div>
        </div>
        <script>
          window.onload = function() {
            setTimeout(function() { window.print(); }, 300);
          };
        </script>
      </body>
    </html>`,
  );
};

export const printOrderReceipt = (order: any) => {
  const { company, phone } = getPrintCompanyContext();
  const client = resolvePrintClientMeta(order);
  const remitoNum = order.invoiceNumber || order.remitoNumber || `INT-${String(order.id).padStart(5, '0')}`;
  const receiptDateValue = order.invoicedAt || order.createdAt;
  const formattedDate = receiptDateValue
    ? new Date(receiptDateValue).toLocaleString('es-AR')
    : new Date().toLocaleString('es-AR');
  const items = order.items || order.orderItems || [];

  const itemsHtml = items
    .map((item: any) => {
      const price = roundIntPesoPrint(item.unitPrice ?? item.price ?? 0);
      const isPesable = Boolean(
        item.product?.isPesable || item.isPesable || (item.weight && Number(item.weight) > 0),
      );
      const subtotal = computeFallbackItemSubtotalPrint(item);
      const approxKg = (Number(item.quantity || 0) * Number(item.product?.approximateWeight || 1)).toLocaleString('es-AR');
      const cantDisplay =
        isPesable && item.weight
          ? `${item.quantity} u (${Number(item.weight).toFixed(2)} kg)`
          : isPesable
            ? `${item.quantity} u (${approxKg} kg aprox)`
            : `${item.quantity} u`;

      return `<tr>
        <td>${escapePrintHtml(item.product?.name || item.name || 'Artículo')}</td>
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
          body { font-family: 'Courier New', Courier, monospace; padding: 15px; color: #000; font-size: 13px; line-height: 1.4; }
          .header-grid { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px; }
          .logo { font-size: 1.35rem; font-weight: 800; letter-spacing: -0.4px; }
          .comp-no { font-size: 1.05rem; font-weight: 800; text-align: right; }
          .meta-text { font-size: 0.78rem; color: #374151; }
          .divider { border-top: 1px dashed #000; margin: 10px 0; }
          table { width: 100%; border-collapse: collapse; margin-top: 4px; }
          th { text-align: left; border-bottom: 1px solid #000; padding-bottom: 4px; font-size: 0.85rem; }
          td { padding: 4px 0; font-size: 0.85rem; }
          .text-right { text-align: right; }
          .footer { text-align: center; margin-top: 16px; font-size: 0.9rem; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="header-grid">
          <div>
            <div class="logo">${escapePrintHtml(company.nombreFantasia)}</div>
            <div class="meta-text">${escapePrintHtml(company.razonSocial)}${phone ? ` · ${escapePrintHtml(phone)}` : ''}</div>
            <div class="meta-text">Fecha: ${formattedDate}</div>
          </div>
          <div class="comp-no">
            <div>COMPROBANTE</div>
            <div>N° ${escapePrintHtml(remitoNum)}</div>
          </div>
        </div>
        <div class="divider"></div>
        <div><strong>Cliente:</strong> ${escapePrintHtml(client.name)}</div>
        <div><strong>CUIT / DNI:</strong> ${escapePrintHtml(client.cuit)}</div>
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
        <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 1.15rem; margin-top: 4px;">
          <span>TOTAL A PAGAR:</span>
          <span>$${formatArsPrint(order.totalAmount || 0)}</span>
        </div>
        <div class="divider"></div>
        <div class="footer"><p>¡Muchas gracias por su compra!</p></div>
        <script>
          window.onload = function() { window.print(); };
        </script>
      </body>
    </html>`,
  );
};
