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

function formatPresupuestoPaymentMethod(paymentMethod?: string): string {
  switch (paymentMethod) {
    case 'BANK_TRANSFER':
      return 'Transferencia';
    case 'CHECK':
      return 'Cheque';
    case 'CASH':
      return 'Efectivo';
    default:
      return 'Cuenta Corriente';
  }
}

export const printRemitoX = (order: any) => {
  const client = resolvePrintClientMeta(order);
  const persona = client.persona;
  const issueDateValue = order.invoicedAt || order.issueDate || order.createdAt;
  const formattedDate = issueDateValue
    ? new Date(issueDateValue).toLocaleDateString('es-AR')
    : new Date().toLocaleDateString('es-AR');

  const compNro = order.invoiceNumber
    ? String(order.invoiceNumber)
    : order.remitoNumber
      ? String(order.remitoNumber)
      : `INT-${String(order.id || 0).padStart(5, '0')}`;

  const clientName = persona?.name || order.clientName || 'Consumidor Final';
  const clientCity = (persona?.city || '').trim();
  const clientBarrio = (persona?.barrio || '').trim();
  const clientBarrioLabel = clientBarrio
    ? /^(barrio|b°|b\.)\b/i.test(clientBarrio)
      ? clientBarrio
      : `Barrio ${clientBarrio}`
    : '';
  const clientLocation = [clientCity, clientBarrioLabel].filter(Boolean).join(' · ');
  const clientAddress = persona?.address || 'Retiro en Local';
  const rawCuit = persona?.cuit ? String(persona.cuit).trim() : '';
  const clientCuit = rawCuit && rawCuit !== 'S/D' ? rawCuit : null;
  const outstandingBalance = roundIntPesoPrint(client.outstandingBalance ?? 0);
  const totalAmount = roundIntPesoPrint(order.totalAmount || 0);
  const items = order.items || order.orderItems || [];

  const rowsHtml =
    items.length > 0
      ? items
          .map((it: any, idx: number) => {
            const isLast = idx === items.length - 1;
            const sku = escapePrintHtml(it.product?.sku || 'S/D');
            const name = escapePrintHtml(it.product?.name || it.productName || it.name || 'Artículo general');
            const cant = escapePrintHtml(it.quantity ?? 0);
            const weightDisplay = it.weight ? escapePrintHtml(it.weight) : '-';
            const price = roundIntPesoPrint(it.unitPrice ?? it.price ?? 0);
            const subtotal = computeFallbackItemSubtotalPrint(it);
            return `
              <tr style="border-bottom: ${isLast ? 'none' : '1px solid #f3f4f6'};">
                <td class="col-sku">${sku}</td>
                <td class="col-name">${name}</td>
                <td class="col-num">${cant}</td>
                <td class="col-num">${weightDisplay}</td>
                <td class="col-num">$${formatArsPrint(price)}</td>
                <td class="col-total">$${formatArsPrint(subtotal)}</td>
              </tr>`;
          })
          .join('')
      : `<tr><td colspan="6" style="padding: 16px; text-align: center; color: #6b7280;">Sin ítems registrados</td></tr>`;

  openPrintDocument(
    'width=900,height=1100',
    `<!DOCTYPE html>
    <html>
      <head>
        <title>Presupuesto N° ${escapePrintHtml(compNro)}</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: ${PRINT_FONT_STACK}; color: #111827; background: #ffffff; padding: 20px; font-size: 12.8px; line-height: 1.38; }
          .sheet { background: #ffffff; padding: 20px 24px; border: 1px solid #e5e7eb; border-radius: 8px; min-height: 262mm; display: flex; flex-direction: column; justify-content: space-between; }
          .header { display: flex; justify-content: space-between; align-items: center; padding-bottom: 12px; margin-bottom: 14px; border-bottom: 1px solid #e5e7eb; }
          .doc-title { font-size: 16.8px; font-weight: 700; letter-spacing: -0.01em; color: #111827; }
          .doc-number { font-size: 14.7px; font-weight: 600; color: #111827; margin-top: 2px; font-variant-numeric: tabular-nums; }
          .doc-date { text-align: right; font-size: 13.1px; color: #6b7280; font-variant-numeric: tabular-nums; }
          .meta-grid { display: grid; grid-template-columns: 1.35fr 1fr; gap: 14px; padding: 10px 14px; margin-bottom: 14px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; }
          .meta-right { border-left: 1px solid #e5e7eb; padding-left: 18px; }
          .meta-label { font-size: 10.4px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: #6b7280; margin-bottom: 4px; }
          .client-name { font-size: 15.2px; font-weight: 700; color: #111827; }
          .client-location { font-size: 12.5px; font-weight: 500; color: #374151; margin-top: 2px; }
          .client-sub { font-size: 12.5px; color: #4b5563; margin-top: 2px; }
          .cond-value { font-size: 14.7px; font-weight: 600; color: #111827; }
          .cond-sub { font-size: 12.5px; color: #6b7280; margin-top: 2px; font-variant-numeric: tabular-nums; }
          .table-wrap { border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; margin-bottom: 14px; }
          table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
          thead tr { background: #f9fafb; border-bottom: 1px solid #e5e7eb; }
          th { padding: 8px; font-size: 10.6px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280; text-align: left; }
          th.r { text-align: right; }
          td { padding: 6px 8px; }
          .col-sku { padding-left: 10px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11.8px; color: #6b7280; }
          .col-name { font-weight: 500; color: #111827; }
          .col-num { text-align: right; font-variant-numeric: tabular-nums; color: #374151; }
          .col-total { padding-right: 10px; text-align: right; font-weight: 600; font-variant-numeric: tabular-nums; color: #111827; }
          .footer { display: flex; justify-content: space-between; align-items: flex-end; gap: 20px; padding-top: 12px; }
          .legal-note { font-size: 11.5px; color: #9ca3af; }
          .totals-box { min-width: 250px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px 16px; }
          .totals-row { display: flex; justify-content: space-between; font-size: 12.8px; color: #4b5563; margin-bottom: 8px; font-variant-numeric: tabular-nums; }
          .totals-final { display: flex; justify-content: space-between; align-items: baseline; border-top: 1px solid #e5e7eb; padding-top: 8px; font-size: 17.6px; font-weight: 700; color: #111827; font-variant-numeric: tabular-nums; }
          @media print {
            body { padding: 0; background: #ffffff; }
            .sheet { border: none; border-radius: 0; min-height: 270mm; }
            @page { size: A4 portrait; margin: 10mm; }
          }
        </style>
      </head>
      <body>
        <div class="sheet">
          <div>
            <div class="header">
              <div>
                <div class="doc-title">Presupuesto</div>
                <div class="doc-number">N° ${escapePrintHtml(compNro)}</div>
              </div>
              <div class="doc-date">${escapePrintHtml(formattedDate)}</div>
            </div>

            <div class="meta-grid">
              <div>
                <div class="meta-label">Cliente</div>
                <div class="client-name">${escapePrintHtml(clientName)}</div>
                ${clientLocation ? `<div class="client-location">${escapePrintHtml(clientLocation)}</div>` : ''}
                <div class="client-sub">${escapePrintHtml(clientAddress)}${clientCuit ? ` · CUIT/DNI ${escapePrintHtml(clientCuit)}` : ''}</div>
              </div>
              <div class="meta-right">
                <div class="meta-label">Condición</div>
                <div class="cond-value">${escapePrintHtml(formatPresupuestoPaymentMethod(order.paymentMethod))}</div>
                <div class="cond-sub">Saldo CC: $${formatArsPrint(outstandingBalance)}</div>
              </div>
            </div>

            <div class="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th style="width: 56px; padding-left: 10px;">SKU</th>
                    <th>Artículo</th>
                    <th class="r" style="width: 48px;">Cant.</th>
                    <th class="r" style="width: 54px;">Kilos</th>
                    <th class="r" style="width: 90px;">P. Unit</th>
                    <th class="r" style="width: 96px; padding-right: 10px;">Importe</th>
                  </tr>
                </thead>
                <tbody>${rowsHtml}</tbody>
              </table>
            </div>
          </div>

          <div class="footer">
            <div class="legal-note">Documento no válido como factura</div>
            <div class="totals-box">
              <div class="totals-row">
                <span>Subtotal</span>
                <span>$${formatArsPrint(totalAmount)}</span>
              </div>
              <div class="totals-final">
                <span>Total</span>
                <span>$${formatArsPrint(totalAmount)}</span>
              </div>
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
