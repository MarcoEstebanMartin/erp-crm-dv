import {
  PRINT_FONT_STACK,
  escapePrintHtml,
  getPrintCompanyContext,
  openPrintDocument,
  resolvePrintClientMeta,
} from './printFormatters';

interface BultoLabel {
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
}

export const printShippingLabelsBultos = ({ orders }: { orders: any[] }) => {
  const { company } = getPrintCompanyContext();
  const labels: BultoLabel[] = [];

  orders.forEach((order) => {
    const client = resolvePrintClientMeta(order);
    const bultosCount = Math.max(1, Number(order.bultosCount || 1));
    const driverName = order.deliveryRoute?.driverName || 'Reparto General';
    const sellerName = order.seller?.username || order.seller?.name || 'Vendedor';
    const notes = order.notes || order.bultosDetails?.notes || '';
    const isPesable = (order.items || []).some(
      (i: any) => i.product?.isPesable || (i.weight && Number(i.weight) > 0),
    );

    for (let i = 1; i <= bultosCount; i++) {
      labels.push({
        orderId: order.id,
        clientName: client.name,
        address: client.address,
        city: client.city,
        driverName,
        sellerName,
        bultoIndex: i,
        totalBultos: bultosCount,
        notes,
        isPesable,
      });
    }
  });

  const labelsHtml = labels
    .map(
      (lbl) => `
      <div class="label-page">
        <div>
          <div class="brand-header">
            <div class="brand-name">${escapePrintHtml(company.nombreFantasia)}</div>
            <div style="font-size: 11px; font-weight: 800;">RÓTULO OFICIAL DE DESPACHO Y CONTROL</div>
          </div>
          <div class="bulto-badge">
            <span>PEDIDO #${lbl.orderId}</span>
            <span>BULTO ${lbl.bultoIndex} DE ${lbl.totalBultos}</span>
          </div>
          <div class="client-box">
            <div class="client-title">${escapePrintHtml(lbl.clientName)}</div>
            <div class="client-dest">Destino: ${escapePrintHtml(lbl.address)}${lbl.city ? ` (${escapePrintHtml(lbl.city)})` : ''}</div>
          </div>
          <div class="route-info">
            <div><strong>REPARTO / RUTA:</strong> ${escapePrintHtml(lbl.driverName.toUpperCase())}</div>
            <div><strong>VENDEDOR:</strong> ${escapePrintHtml(lbl.sellerName.toUpperCase())}</div>
            <div><strong>FECHA DE CARGA:</strong> ${new Date().toLocaleDateString('es-AR')}</div>
          </div>
          ${lbl.isPesable ? '<div class="frio-tag">CONTIENE ARTÍCULOS PESABLES / FRÍO</div>' : ''}
          ${lbl.notes ? `<div class="notes-box"><strong>NOTA VENDEDOR:</strong> ${escapePrintHtml(lbl.notes)}</div>` : ''}
        </div>
        <div>
          <div style="text-align: center; margin-bottom: 4px; font-size: 11px; font-weight: 800;">
            VERIFICAR FAJA DE SEGURIDAD / CONTROL EN PORTÓN
          </div>
          <div class="footer-code">*DV-ORD-${lbl.orderId}-B${lbl.bultoIndex}OF${lbl.totalBultos}*</div>
        </div>
      </div>`,
    )
    .join('');

  openPrintDocument(
    'width=600,height=800',
    `<!DOCTYPE html>
    <html>
      <head>
        <title>Etiquetas de Despacho Térmicas</title>
        <style>
          @page { size: 100mm 150mm; margin: 0; }
          * { box-sizing: border-box; }
          body { font-family: ${PRINT_FONT_STACK}; margin: 0; padding: 0; background: #fff; color: #000; }
          .label-page { width: 100mm; height: 145mm; padding: 6mm 8mm; page-break-after: always; page-break-inside: avoid; display: flex; flex-direction: column; justify-content: space-between; border: 2px solid #000; }
          .label-page:last-child { page-break-after: avoid; }
          .brand-header { text-align: center; border-bottom: 3px solid #000; padding-bottom: 4px; }
          .brand-name { font-size: 16px; font-weight: 900; letter-spacing: 0.5px; text-transform: uppercase; }
          .bulto-badge { font-size: 22px; font-weight: 900; background: #000; color: #fff; padding: 4px 10px; border-radius: 6px; text-align: center; margin: 8px 0; display: flex; justify-content: space-between; align-items: center; }
          .client-box { border: 2px solid #000; padding: 8px; border-radius: 6px; margin: 6px 0; }
          .client-title { font-size: 16px; font-weight: 900; line-height: 1.1; text-transform: uppercase; }
          .client-dest { font-size: 13px; font-weight: 700; margin-top: 4px; }
          .route-info { font-size: 12.5px; font-weight: 700; border-top: 2px dashed #000; border-bottom: 2px dashed #000; padding: 6px 0; margin: 6px 0; }
          .frio-tag { font-size: 12px; font-weight: 900; background: #000; color: #fff; padding: 4px; text-align: center; border-radius: 4px; margin-top: 4px; }
          .notes-box { background: #f3f4f6; border: 1.5px solid #000; border-radius: 4px; padding: 6px; font-size: 12px; font-weight: 700; margin-top: 4px; }
          .footer-code { text-align: center; font-family: monospace; font-size: 14px; font-weight: bold; letter-spacing: 2px; border-top: 2px solid #000; padding-top: 4px; }
          @media print { body { -webkit-print-color-adjust: exact; } }
        </style>
      </head>
      <body>
        ${labelsHtml}
        <script>
          window.onload = function() {
            setTimeout(() => { window.print(); }, 400);
          };
        </script>
      </body>
    </html>`,
  );
};

export const printDeliveryRouteCustodyGuide = (route: any) => {
  const { company } = getPrintCompanyContext();
  const orders = route.orders || [];

  const totalBultosFraccionados = orders.reduce(
    (sum: number, o: any) => sum + Math.max(1, Number(o.bultosCount || 1)),
    0,
  );
  const totalCajasTablaEstimadas = orders.reduce((sum: number, o: any) => {
    const tablaItems = (o.items || []).filter(
      (i: any) =>
        (i.product?.pickingZone === 'TABLA' || i.product?.rubro?.pickingZone === 'TABLA') &&
        !i.product?.isPesable,
    );
    return (
      sum +
      tablaItems.reduce(
        (acc: number, item: any) => acc + Math.floor(item.quantity / (item.product?.unitsPerBox || 1)),
        0,
      )
    );
  }, 0);

  const totalBultosRuta = totalBultosFraccionados + totalCajasTablaEstimadas;
  const driverNameUpper = escapePrintHtml((route.driverName || '').toUpperCase());
  const companionHtml = route.companionName
    ? `Acompañante: ${escapePrintHtml(route.companionName.toUpperCase())}`
    : '';
  const logoSrc =
    typeof window !== 'undefined' && window.location?.origin
      ? `${window.location.origin}/logo.png`
      : '/logo.png';

  const rowsHtml = orders
    .map((o: any) => {
      const client = resolvePrintClientMeta(o);
      const addressLine = [client.address, client.city].filter(Boolean).join(' · ');
      const noteText = (o.notes || o.bultosDetails?.notes || '').trim();
      return `<tr>
        <td class="col-check"><span class="check-box"></span></td>
        <td class="col-check"><span class="check-box"></span></td>
        <td class="col-transf"><span class="check-box"></span></td>
        <td class="col-id">#${o.id}</td>
        <td>
          <div class="client-name">${escapePrintHtml(client.name)}</div>
          ${addressLine ? `<div class="client-addr">${escapePrintHtml(addressLine)}</div>` : ''}
        </td>
        <td class="col-bultos">${o.bultosCount || 1} u</td>
        <td class="col-notes">${noteText ? escapePrintHtml(noteText) : '<span class="muted">—</span>'}</td>
      </tr>`;
    })
    .join('');

  openPrintDocument(
    'width=960,height=1100',
    `<!DOCTYPE html>
    <html lang="es">
      <head>
        <title>Viaje #${route.id}</title>
        <style>
          @page { size: A4 portrait; margin: 14mm 15mm; }
          * { box-sizing: border-box; }
          body { font-family: ${PRINT_FONT_STACK}; font-size: 11px; color: #111827; background: #f3f4f6; margin: 0; padding: 16px; line-height: 1.35; -webkit-font-smoothing: antialiased; }
          .page { width: 210mm; min-height: 297mm; margin: 0 auto; padding: 14mm 15mm; background: #fff; box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08); }
          .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #111827; padding-bottom: 10px; margin-bottom: 14px; }
          .brand-logo { max-height: 36px; max-width: 140px; object-fit: contain; display: block; }
          .route-ref { text-align: right; }
          .route-num { font-size: 16px; font-weight: 700; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; }
          .route-date { font-size: 10.5px; color: #6b7280; font-variant-numeric: tabular-nums; margin-top: 1px; }
          .meta-strip { display: grid; grid-template-columns: 1.35fr 1.15fr 0.8fr 0.8fr 0.75fr; border: 1px solid #e5e7eb; border-radius: 6px; margin-bottom: 16px; overflow: hidden; }
          .meta-cell { padding: 9px 11px; border-right: 1px solid #e5e7eb; }
          .meta-cell:last-child { border-right: none; background: #f9fafb; }
          .meta-label { font-size: 9px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280; margin-bottom: 3px; }
          .meta-val { font-size: 11.5px; font-weight: 600; color: #111827; font-variant-numeric: tabular-nums; }
          .meta-sub { font-size: 9.5px; color: #6b7280; margin-top: 1px; }
          .section-label { font-size: 9.5px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: #6b7280; margin: 0 0 6px 0; }
          table { width: 100%; border-collapse: collapse; }
          th { border-bottom: 1px solid #d1d5db; padding: 6px 6px; font-size: 9px; text-transform: uppercase; letter-spacing: 0.04em; font-weight: 600; color: #6b7280; text-align: left; }
          td { border-bottom: 1px solid #f3f4f6; padding: 7px 6px; vertical-align: middle; }
          .col-check { width: 42px; text-align: center; }
          .col-transf { width: 78px; text-align: center; }
          .check-box { display: inline-block; width: 13px; height: 13px; border: 1px solid #9ca3af; border-radius: 3px; vertical-align: middle; }
          .col-id { width: 52px; font-weight: 600; font-variant-numeric: tabular-nums; color: #374151; }
          .client-name { font-weight: 600; color: #111827; font-size: 10.5px; }
          .client-addr { font-size: 9px; color: #6b7280; margin-top: 1px; }
          .col-bultos { width: 54px; text-align: center; font-weight: 600; font-variant-numeric: tabular-nums; }
          .col-notes { font-size: 9.5px; color: #4b5563; }
          .muted { color: #9ca3af; }
          .dispatch-footer { margin-top: 32px; break-inside: avoid; }
          .sig-block { max-width: 320px; border-top: 1px solid #9ca3af; padding-top: 6px; }
          .sig-title { font-size: 10px; font-weight: 600; color: #111827; }
          .sig-sub { font-size: 9px; color: #6b7280; margin-top: 2px; }
          @media print {
            body { background: #fff; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .page { width: auto; min-height: 0; margin: 0; padding: 0; box-shadow: none; }
          }
        </style>
      </head>
      <body>
        <div class="page">
          <div class="header">
            <img src="${logoSrc}" alt="${escapePrintHtml(company.nombreFantasia)}" class="brand-logo" />
            <div class="route-ref">
              <div class="route-num">Viaje #${route.id}</div>
              <div class="route-date">${new Date(route.date || Date.now()).toLocaleDateString('es-AR')}</div>
            </div>
          </div>
          <div class="meta-strip">
            <div class="meta-cell">
              <div class="meta-label">Chofer</div>
              <div class="meta-val">${driverNameUpper || 'S/D'}</div>
              ${companionHtml ? `<div class="meta-sub">${companionHtml}</div>` : ''}
            </div>
            <div class="meta-cell">
              <div class="meta-label">Vehículo</div>
              <div class="meta-val">${escapePrintHtml(route.vehiclePlate || 'S/D')}</div>
              ${route.vehicleDescription ? `<div class="meta-sub">${escapePrintHtml(route.vehicleDescription)}</div>` : ''}
            </div>
            <div class="meta-cell">
              <div class="meta-label">Cajas tabla</div>
              <div class="meta-val">~ ${totalCajasTablaEstimadas}</div>
            </div>
            <div class="meta-cell">
              <div class="meta-label">Fajados</div>
              <div class="meta-val">${totalBultosFraccionados} u</div>
            </div>
            <div class="meta-cell">
              <div class="meta-label">Total carga</div>
              <div class="meta-val" style="font-size: 13px;">${totalBultosRuta}</div>
            </div>
          </div>
          <div class="section-label">Pedidos (${orders.length})</div>
          <table>
            <thead>
              <tr>
                <th class="col-check">Debe</th>
                <th class="col-check">Pagó</th>
                <th class="col-transf">Transferencia</th>
                <th class="col-id">Pedido</th>
                <th>Cliente</th>
                <th class="col-bultos">Bultos</th>
                <th>Notas</th>
              </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
          </table>
          <div class="dispatch-footer">
            <div class="sig-block">
              <div class="sig-title">Responsable Despacho</div>
              <div class="sig-sub">Fecha y hora de carga: ____ / ____ / ____ · ____ : ____ hs</div>
            </div>
          </div>
        </div>
        <script>
          window.onload = function() {
            setTimeout(() => { window.print(); }, 400);
          };
        </script>
      </body>
    </html>`,
  );
};
