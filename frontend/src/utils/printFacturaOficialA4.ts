import { getCompanyProfile } from './companyProfile';
import { resolveOrderPersona } from './orderSearchAndStatus.helper';

export function printFacturaOficialA4(order: any): void {
  const printWindow = window.open('', '_blank', 'width=900,height=1100');
  if (!printWindow) return;

  const company = getCompanyProfile();
  const companyCuit = company.cuit;
  const companyIibb = company.iibb;
  const companyAddress = company.direccion;
  const companyInitDate = company.inicioActividades;
  const puntoVentaStr = String(order.puntoVenta || company.puntoVenta || 1).padStart(4, '0');

  const formattedDate = order.createdAt
    ? new Date(order.createdAt).toLocaleDateString('es-AR', {
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

  const client = resolveOrderPersona(order);
  const clientName = client?.name || order.clientName || 'CONSUMIDOR FINAL';
  const clientCity = client?.city || 'GENERAL VILLEGAS - BUENOS AIRES';
  const clientAddress = client?.address || 'Retira en local';
  const clientCuit = client?.cuit || 'Consumidor Final';
  const clientBalance = Math.round(Number(client?.outstandingBalance ?? 0));

  const isFacturaA = order.invoiceType
    ? order.invoiceType === 'FACTURA_A'
    : Boolean(String(order.invoiceNumber || '').startsWith('PRE-A'));

  const clientIva =
    client?.taxCondition || (isFacturaA ? 'Responsable Inscripto' : 'Consumidor Final');
  const letterBox = isFacturaA ? 'A' : order.invoiceType === 'FACTURA_C' ? 'C' : 'B';
  const letterCode = isFacturaA ? 'COD. 001' : order.invoiceType === 'FACTURA_C' ? 'COD. 011' : 'COD. 006';
  const docTitle = isFacturaA ? 'FACTURA A' : order.invoiceType === 'FACTURA_C' ? 'FACTURA C' : 'FACTURA B';
  const invNumber = order.invoiceNumber || `PRE-${letterBox}-${String(order.id).padStart(6, '0')}`;

  const items = order.items || order.orderItems || [];
  let computedNetoTotal = 0;
  let computedIvaTotal = 0;

  const processedItems = items.map((it: any) => {
    const qty = Number(it.quantity || 0);
    const isPesable = Boolean(it.product?.isPesable) || (it.weight != null && Number(it.weight) > 0);
    const hasExactWeight = isPesable && it.weight != null && Number(it.weight) > 0;
    const effectiveMeasure = hasExactWeight ? Number(it.weight) : qty;
    const unitPriceWithIva = Number(it.unitPrice ?? it.price ?? 0);
    const subtotalWithIva = Number(it.subtotal ?? effectiveMeasure * unitPriceWithIva);

    const netUnitPrice = isFacturaA ? unitPriceWithIva / 1.21 : unitPriceWithIva;
    const netSubtotal = isFacturaA ? subtotalWithIva / 1.21 : subtotalWithIva / 1.21;
    const itemIva = subtotalWithIva - netSubtotal;

    computedNetoTotal += netSubtotal;
    computedIvaTotal += itemIva;

    return {
      measureLabel: hasExactWeight
        ? `${Number(it.weight).toFixed(2)} kg`
        : `${qty.toFixed(0)} u`,
      name: it.product?.name || it.name || 'Producto',
      displayUnitPrice: netUnitPrice,
      displaySubtotal: isFacturaA ? netSubtotal : subtotalWithIva,
    };
  });

  const netoTotal =
    order.netAmount != null && Number(order.netAmount) > 0
      ? Number(order.netAmount)
      : computedNetoTotal;
  const ivaTotal =
    order.taxAmount != null && Number(order.taxAmount) >= 0
      ? Number(order.taxAmount)
      : computedIvaTotal;
  const percepIibb = Number(order.percepcionAmount || 0);
  const percepIva = Number(order.percepcionIvaAmount || 0);
  const grandTotal = Number(order.totalAmount || netoTotal + ivaTotal + percepIibb + percepIva);
  const hasCae = Boolean(order.cae);
  const priceColHeader = isFacturaA ? 'Precio (s/ IVA)' : 'Precio Unit.';
  const subtotalColHeader = isFacturaA ? 'Subtotal (s/ IVA)' : 'Subtotal';

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>${docTitle} - N° ${invNumber}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;700&display=swap');
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: 'Plus Jakarta Sans', 'Inter', system-ui, -apple-system, sans-serif; color: #0f172a; background: #ffffff; padding: 24px; font-size: 12px; line-height: 1.4; }
          .invoice-card { border: 1px solid #cbd5e1; border-radius: 8px; overflow: hidden; background: #ffffff; min-height: 255mm; display: flex; flex-direction: column; justify-content: space-between; }
          .top-banner { background: #f8fafc; border-bottom: 1px solid #cbd5e1; padding: 6px 16px; text-align: center; font-weight: 800; font-size: 11px; letter-spacing: 0.1em; color: #0f172a; }
          .header-main { display: flex; align-items: stretch; border-bottom: 1px solid #cbd5e1; }
          .header-left { flex: 1.2; padding: 16px 20px; border-right: 1px solid #cbd5e1; }
          .company-sub { font-size: 11px; color: #64748b; margin-top: 3px; font-weight: 500; }
          .header-center { width: 100px; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 12px; border-right: 1px solid #cbd5e1; background: #fafafa; }
          .letter-box { width: 44px; height: 44px; border: 2px solid #0f172a; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: 900; color: #0f172a; background: #ffffff; }
          .letter-code { font-size: 9px; font-weight: 700; color: #64748b; margin-top: 4px; text-transform: uppercase; }
          .header-right { flex: 1; padding: 16px 20px; display: flex; flex-direction: column; justify-content: center; background: #ffffff; }
          .doc-title { font-size: 18px; font-weight: 800; color: #0f172a; letter-spacing: 0.05em; }
          .doc-meta { margin-top: 3px; font-size: 11px; color: #334155; }
          .doc-meta strong { color: #0f172a; }
          .info-grid { display: flex; border-bottom: 1px solid #cbd5e1; }
          .client-block { flex: 1.4; padding: 14px 20px; border-right: 1px solid #cbd5e1; }
          .sale-block { flex: 1; padding: 14px 20px; background: #fafafa; }
          .block-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; margin-bottom: 6px; }
          .client-title { font-size: 14px; font-weight: 700; color: #0f172a; }
          .info-row { display: flex; justify-content: space-between; margin-top: 4px; font-size: 11px; color: #334155; }
          .table-container { width: 100%; flex: 1; }
          table { width: 100%; border-collapse: collapse; }
          th { background: #f1f5f9; color: #334155; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; padding: 10px 14px; text-align: left; border-bottom: 1px solid #cbd5e1; }
          td { padding: 10px 14px; border-bottom: 1px solid #e2e8f0; font-size: 11px; color: #1e293b; }
          .text-right { text-align: right; }
          .text-center { text-align: center; }
          .mono { font-family: 'JetBrains Mono', monospace; font-weight: 500; }
          .font-bold { font-weight: 700; }
          .footer-section { border-top: 1px solid #cbd5e1; background: #f8fafc; padding: 16px 20px; display: flex; justify-content: space-between; align-items: flex-end; }
          .fiscal-block { display: flex; align-items: center; gap: 16px; }
          .arca-badge { border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px 12px; background: #ffffff; display: flex; align-items: center; gap: 10px; }
          .cae-meta { font-size: 10px; color: #334155; line-height: 1.4; }
          .cae-meta strong { color: #0f172a; }
          .draft-warning { background: #fef3c7; color: #92400e; border: 1px solid #f59e0b; padding: 8px 14px; border-radius: 6px; font-weight: 700; font-size: 10px; letter-spacing: 0.05em; }
          .totals-table { width: 260px; }
          .totals-row { display: flex; justify-content: space-between; font-size: 11px; color: #475569; margin-top: 3px; }
          .totals-grand { border-top: 2px solid #0f172a; margin-top: 6px; padding-top: 6px; font-size: 15px; font-weight: 800; color: #0f172a; }
          @media print {
            body { padding: 0; background: #fff; }
            .invoice-card { border: 1px solid #000; border-radius: 0; min-height: 270mm; }
            th { background: #eee !important; color: #000 !important; }
            .top-banner { background: #f0f0f0 !important; color: #000 !important; }
            @page { size: A4 portrait; margin: 10mm; }
          }
        </style>
      </head>
      <body>
        <div class="invoice-card">
          <div>
            <div class="top-banner">ORIGINAL</div>

            <div class="header-main">
              <div class="header-left">
                <img src="${window.location.origin}/logo.png" alt="${company.nombreFantasia}" style="max-height: 52px; max-width: 190px; object-fit: contain; margin-bottom: 4px;" />
                <div class="company-sub"><strong>Razón Social:</strong> ${company.razonSocial}</div>
                <div class="company-sub">${companyAddress}</div>
                <div class="company-sub"><strong>CUIT:</strong> ${companyCuit}${companyIibb ? ` &nbsp;|&nbsp; <strong>IIBB:</strong> ${companyIibb}` : ''}</div>
                <div class="company-sub"><strong>Condición IVA:</strong> RESPONSABLE INSCRIPTO</div>
              </div>

              <div class="header-center">
                <div class="letter-box">${letterBox}</div>
                <div class="letter-code">${letterCode}</div>
              </div>

              <div class="header-right">
                <div class="doc-title">${docTitle}</div>
                <div class="doc-meta"><strong>Punto de Venta:</strong> ${puntoVentaStr} &nbsp;|&nbsp; <strong>Comp. N°:</strong> ${invNumber}</div>
                <div class="doc-meta"><strong>Fecha de Emisión:</strong> ${formattedDate}</div>
                <div class="doc-meta"><strong>Vencimiento:</strong> ${formattedDueDate}</div>
                ${companyInitDate ? `<div class="doc-meta"><strong>Inicio de Actividades:</strong> ${companyInitDate}</div>` : ''}
              </div>
            </div>

            <div class="info-grid">
              <div class="client-block">
                <div class="block-label">Cliente (Destinatario)</div>
                <div class="client-title">${clientName}</div>
                <div class="info-row"><span><strong>Dirección:</strong> ${clientAddress}</span><span><strong>Localidad:</strong> ${clientCity}</span></div>
                <div class="info-row"><span><strong>Categoría IVA:</strong> ${clientIva}</span><span><strong>CUIT / DNI:</strong> ${clientCuit}</span></div>
              </div>

              <div class="sale-block">
                <div class="block-label">Condición Comercial</div>
                <div class="info-row"><span><strong>Forma de Pago:</strong> ${order.paymentMethod || 'CUENTA CORRIENTE'}</span></div>
                <div class="info-row"><span><strong>Saldo Anterior:</strong> $ ${clientBalance.toLocaleString('es-AR')},00</span></div>
              </div>
            </div>

            <div class="table-container">
              <table>
                <thead>
                  <tr>
                    <th style="width: 10%;" class="text-center">Cant. / Kg</th>
                    <th style="width: 50%;">PRODUCTO / DETALLE</th>
                    <th style="width: 10%;" class="text-center">% IVA</th>
                    <th style="width: 15%;" class="text-right">${priceColHeader}</th>
                    <th style="width: 15%;" class="text-right">${subtotalColHeader}</th>
                  </tr>
                </thead>
                <tbody>
                  ${
                    processedItems.length > 0
                      ? processedItems
                          .map(
                            (it: any) => `
                    <tr>
                      <td class="text-center mono font-bold">${it.measureLabel}</td>
                      <td><strong>${it.name}</strong></td>
                      <td class="text-center mono">21.00%</td>
                      <td class="text-right mono">$ ${it.displayUnitPrice.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td class="text-right mono font-bold">$ ${it.displaySubtotal.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    </tr>
                  `,
                          )
                          .join('')
                      : `
                    <tr>
                      <td colspan="5" class="text-center" style="padding: 20px; color: #94a3b8;">Sin ítems registrados</td>
                    </tr>
                  `
                  }
                </tbody>
              </table>
            </div>
          </div>

          <div class="footer-section">
            <div class="fiscal-block">
              ${
                hasCae
                  ? `
                <div class="arca-badge">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#0f172a" stroke-width="1.5">
                    <rect x="3" y="3" width="7" height="7" rx="1"></rect>
                    <rect x="14" y="3" width="7" height="7" rx="1"></rect>
                    <rect x="3" y="14" width="7" height="7" rx="1"></rect>
                    <path d="M14 14h3v3h-3zM17 17h3v3h-3zM14 17h3v3h-3z"></path>
                  </svg>
                  <div class="cae-meta">
                    <div><strong>CAE N°:</strong> ${order.cae}</div>
                    <div><strong>Fecha Vto. CAE:</strong> ${order.caeDueDate ? new Date(order.caeDueDate).toLocaleDateString('es-AR') : formattedDueDate}</div>
                    <div style="font-size: 8px; color: #64748b; margin-top:2px;">Comprobante Autorizado AFIP / ARCA</div>
                  </div>
                </div>
              `
                  : `
                <div class="draft-warning">
                  COMPROBANTE BORRADOR (PRE-FACTURA)<br/>
                  PENDIENTE DE SOLICITUD DE CAE EN AFIP / ARCA
                </div>
              `
              }
            </div>

            <div class="totals-table">
              ${
                isFacturaA
                  ? `
                <div class="totals-row"><span>Neto Gravado:</span><span class="mono">$ ${netoTotal.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
                <div class="totals-row"><span>Exento:</span><span class="mono">$ 0,00</span></div>
                <div class="totals-row"><span>IVA 21%:</span><span class="mono">$ ${ivaTotal.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
                ${percepIibb > 0 ? `<div class="totals-row"><span>Percepción IIBB:</span><span class="mono">$ ${percepIibb.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>` : ''}
                ${percepIva > 0 ? `<div class="totals-row"><span>Percepción IVA 5329:</span><span class="mono">$ ${percepIva.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>` : ''}
              `
                  : `
                <div class="totals-row"><span>IVA Contenido (Ley 27.743):</span><span class="mono">$ ${ivaTotal.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
              `
              }
              <div class="totals-row totals-grand">
                <span>TOTAL:</span>
                <span class="mono">$ ${grandTotal.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>
        </div>

        <script>
          window.onload = function() {
            setTimeout(function() { window.print(); }, 300);
          }
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
}
