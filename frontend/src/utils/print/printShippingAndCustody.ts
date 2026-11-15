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
    ? ` (Acompañante: ${escapePrintHtml(route.companionName.toUpperCase())})`
    : '';

  const rowsHtml = orders
    .map((o: any) => {
      const client = resolvePrintClientMeta(o);
      return `<tr>
        <td style="text-align: center;"><div style="width: 16px; height: 16px; border: 1.5px solid #000; margin: 0 auto;"></div></td>
        <td><strong>#${o.id}</strong></td>
        <td>
          <strong>${escapePrintHtml(client.name)}</strong>
          <div style="font-size: 10.5px; color: #374151;">Dir: ${escapePrintHtml(client.address)}${client.city ? ` (${escapePrintHtml(client.city)})` : ''}</div>
        </td>
        <td style="text-align: center; font-weight: 900; font-size: 13px;">${o.bultosCount || 1} u</td>
        <td style="font-size: 11px;">${escapePrintHtml(o.notes || o.bultosDetails?.notes || '-')}</td>
      </tr>`;
    })
    .join('');

  openPrintDocument(
    'width=900,height=1100',
    `<!DOCTYPE html>
    <html>
      <head>
        <title>Guía de Carga y Transferencia de Custodia - Ruta #${route.id}</title>
        <style>
          @page { size: A4 portrait; margin: 10mm; }
          * { box-sizing: border-box; }
          body { font-family: ${PRINT_FONT_STACK}; font-size: 12px; color: #111827; margin: 0; padding: 0; }
          .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #000; padding-bottom: 8px; margin-bottom: 12px; }
          .title { font-size: 18px; font-weight: 900; text-transform: uppercase; }
          .subtitle { font-size: 12px; font-weight: 700; color: #000; }
          .summary-card { border: 2.5px solid #000; border-radius: 8px; padding: 12px; margin-bottom: 16px; background: #f9fafb; }
          .summary-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 8px; }
          .category-box { border: 1.5px solid #000; border-radius: 6px; padding: 10px; background: #fff; }
          .category-title { font-size: 11px; font-weight: 900; text-transform: uppercase; margin-bottom: 4px; color: #374151; }
          .category-val { font-size: 20px; font-weight: 900; color: #000; }
          table { width: 100%; border-collapse: collapse; margin-top: 12px; }
          th { border: 1.5px solid #000; background: #f3f4f6; padding: 6px 8px; font-size: 11px; text-transform: uppercase; font-weight: 900; text-align: left; }
          td { border: 1px solid #d1d5db; padding: 6px 8px; font-size: 11.5px; vertical-align: middle; }
          .signature-box { border: 2px solid #000; border-radius: 8px; padding: 16px; margin-top: 24px; background: #fff; }
          @media print { body { -webkit-print-color-adjust: exact; } }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="title">${escapePrintHtml(company.nombreFantasia)}</div>
            <div class="subtitle">GUÍA DE CARGA Y ACTA OFICIAL DE TRANSFERENCIA DE CUSTODIA</div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 18px; font-weight: 900;">HOJA DE RUTA #${route.id}</div>
            <div>Fecha: ${new Date(route.date || Date.now()).toLocaleDateString('es-AR')}</div>
          </div>
        </div>
        <div class="summary-card">
          <div style="display: flex; justify-content: space-between; font-size: 13.5px; font-weight: 900; border-bottom: 1.5px solid #000; padding-bottom: 6px;">
            <span>CHOFER / REPARTIDOR: ${driverNameUpper}${companionHtml}</span>
            <span>VEHÍCULO: ${escapePrintHtml(route.vehiclePlate || 'S/D')} ${route.vehicleDescription ? `(${escapePrintHtml(route.vehicleDescription)})` : ''}</span>
          </div>
          <div class="summary-grid">
            <div class="category-box">
              <div class="category-title">1. CAJAS CERRADAS FÁBRICA (TABLA)</div>
              <div class="category-val">~ ${totalCajasTablaEstimadas} Cajas</div>
              <div style="font-size: 10.5px; color: #4b5563; margin-top: 2px;">Palletizado sellado de origen (Conteo masivo)</div>
            </div>
            <div class="category-box">
              <div class="category-title">2. BULTOS FRACCIONADOS Y FRÍO (FAJADOS)</div>
              <div class="category-val">${totalBultosFraccionados} Bultos</div>
              <div style="font-size: 10.5px; color: #4b5563; margin-top: 2px;">Cajas abiertas con Faja de Seguridad y Rótulo Térmico</div>
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
              <th style="width: 30px; text-align: center;">OK</th>
              <th style="width: 70px;">Pedido</th>
              <th>Cliente y Dirección</th>
              <th style="width: 90px; text-align: center;">Bultos Fajados</th>
              <th>Notas / Observaciones Vendedor</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
        <div class="signature-box">
          <div style="font-size: 12px; font-weight: 900; text-transform: uppercase; margin-bottom: 6px;">
            DECLARACIÓN Y TRANSFERENCIA DE CUSTODIA LEGAL DE CARGA
          </div>
          <div style="font-size: 11px; line-height: 1.4; color: #1f2937;">
            Por medio de la presente, el chofer abajo firmante declara haber contado y recibido en perfecta conformidad el total de bultos cerrados y fajados detallados en esta guía. A partir de este momento, asume la responsabilidad total de la custodia y transporte de la mercadería hasta su entrega efectiva al cliente final.
          </div>
          <div style="display: flex; justify-content: space-between; margin-top: 35px; border-top: 1px dashed #000; padding-top: 10px;">
            <div style="width: 45%;">
              <div>________________________________________</div>
              <div style="font-size: 11px; font-weight: 800; margin-top: 3px;">Firma Chofer: ${driverNameUpper}</div>
              <div style="font-size: 10px; color: #4b5563;">DNI / Aclaración:</div>
            </div>
            <div style="width: 45%;">
              <div>________________________________________</div>
              <div style="font-size: 11px; font-weight: 800; margin-top: 3px;">Firma Responsable Despacho / Depósito</div>
              <div style="font-size: 10px; color: #4b5563;">Fecha / Hora Carga: ____/____/______ ____:____ hs</div>
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
