import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getCompanyProfile } from './companyProfile';
import {
  type SummaryRowMetrics,
  buildBookLedger,
  buildConceptSummary,
  buildTaxConditionSummary,
  formatIduoARS,
  formatTriLine,
  normalizeCuitDigits,
  toCentsBigInt,
} from './afipSubdiarioSummary.helper';

export { toCentsBigInt };

export interface AfipMonthlyMetrics {
  ventasNetoCents: bigint;
  ventasIvaCents: bigint;
  ventasTotalCents: bigint;
  comprasNetoCents: bigint;
  comprasIvaCents: bigint;
  comprasTotalCents: bigint;
}

const AR_DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Argentina/Buenos_Aires',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const IDUO_HEADER_FILL: [number, number, number] = [253, 232, 168];
const IDUO_BORDER_COLOR: [number, number, number] = [30, 30, 30];

export function formatCentsARS(cents: bigint, alwaysShowCents: boolean = false): string {
  const sign = cents < 0n ? '-' : '';
  const abs = cents < 0n ? -cents : cents;
  const pesos = abs / 100n;
  const rem = abs % 100n;
  const groupedPesos = pesos.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  if (alwaysShowCents || rem !== 0n) {
    return `${sign}$ ${groupedPesos},${rem.toString().padStart(2, '0')}`;
  }
  return `${sign}$ ${groupedPesos}`;
}

/**
 * Acumula netos, débito/crédito fiscal y totales del Libro IVA Digital usando BigInt en centavos.
 */
export function accumulateAfipMetricsBigInt(
  ventasData: any[],
  comprasData: any[],
): AfipMonthlyMetrics {
  let ventasNetoCents = 0n;
  let ventasIvaCents = 0n;
  let ventasTotalCents = 0n;
  for (const v of ventasData || []) {
    const sign = BigInt(v?.sign === -1 ? -1 : 1);
    ventasNetoCents += toCentsBigInt(v?.neto) * sign;
    ventasIvaCents += toCentsBigInt(v?.iva) * sign;
    ventasTotalCents += toCentsBigInt(v?.total) * sign;
  }

  let comprasNetoCents = 0n;
  let comprasIvaCents = 0n;
  let comprasTotalCents = 0n;
  for (const c of comprasData || []) {
    const sign = BigInt(c?.sign === -1 ? -1 : 1);
    comprasNetoCents += toCentsBigInt(c?.neto) * sign;
    comprasIvaCents += toCentsBigInt(c?.iva) * sign;
    comprasTotalCents += toCentsBigInt(c?.total) * sign;
  }

  return {
    ventasNetoCents,
    ventasIvaCents,
    ventasTotalCents,
    comprasNetoCents,
    comprasIvaCents,
    comprasTotalCents,
  };
}

export function resolveAfipPeriodLastDay(month: number, year: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function formatArDateDDMMYYYY(dateInput: Date | string): string {
  const parsed = new Date(dateInput);
  if (Number.isNaN(parsed.getTime())) return '—';
  const parts = AR_DATE_FORMATTER.formatToParts(parsed);
  const map: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== 'literal') map[part.type] = part.value;
  }
  return `${(map.day || '01').padStart(2, '0')}/${(map.month || '01').padStart(2, '0')}/${map.year || '1970'}`;
}

function formatUtcDateDDMMYYYY(dateInput: Date | string): string {
  const parsed = new Date(dateInput);
  if (Number.isNaN(parsed.getTime())) return '—';
  const day = String(parsed.getUTCDate()).padStart(2, '0');
  const month = String(parsed.getUTCMonth() + 1).padStart(2, '0');
  return `${day}/${month}/${parsed.getUTCFullYear()}`;
}

function drawIduoPageHeader(params: {
  doc: jsPDF;
  title: string;
  empresa: string;
  cuit: string;
  periodLabel: string;
  pageNumber: number;
}): void {
  const { doc, title, empresa, cuit, periodLabel, pageNumber } = params;
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setTextColor(17, 24, 39);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(13);
  doc.text(title, pageWidth / 2, 13, { align: 'center' });

  doc.setFontSize(10.5);
  doc.text('I.V.A. Responsable Inscripto', pageWidth - 10, 20, { align: 'right' });

  doc.text(`Empresa: ${empresa}`, 10, 26);
  doc.text(`CUIT: ${cuit}`, pageWidth - 10, 26, { align: 'right' });

  doc.text(periodLabel, 10, 32);
  doc.text(`HOJA: ${pageNumber}`, pageWidth - 10, 32, { align: 'right' });
}

function mapSummaryToTableRows(rows: SummaryRowMetrics[], totals: SummaryRowMetrics): string[][] {
  const toCells = (r: SummaryRowMetrics): string[] => [
    r.label,
    formatTriLine(r.exento),
    formatTriLine(r.neto21),
    formatTriLine(r.iva21),
    formatTriLine(r.neto21),
    formatTriLine(r.iva21),
    formatTriLine(r.percepIva),
    formatTriLine(r.retIva),
    formatTriLine(r.otrasPercep),
    formatTriLine(r.otrasRet),
    formatTriLine(r.total),
  ];
  return [...rows.map(toCells), toCells(totals)];
}

function renderSummaryTable(params: {
  doc: jsPDF;
  firstColLabel: string;
  rows: SummaryRowMetrics[];
  totals: SummaryRowMetrics;
  headerDrawer: (pageNumber: number) => void;
}): void {
  const { doc, firstColLabel, rows, totals, headerDrawer } = params;
  doc.addPage();
  const body = mapSummaryToTableRows(rows, totals);

  autoTable(doc, {
    margin: { top: 36, left: 10, right: 10, bottom: 10 },
    head: [
      [
        { content: firstColLabel, rowSpan: 2, styles: { valign: 'middle', halign: 'center' } },
        { content: 'Exento', rowSpan: 2, styles: { valign: 'middle', halign: 'center' } },
        { content: 'Alicuota 21%', colSpan: 2, styles: { halign: 'center' } },
        { content: 'Totales IVA', colSpan: 2, styles: { halign: 'center' } },
        { content: 'Percep. IVA', rowSpan: 2, styles: { valign: 'middle', halign: 'center' } },
        { content: 'Ret. IVA', rowSpan: 2, styles: { valign: 'middle', halign: 'center' } },
        { content: 'Otras Percep.', rowSpan: 2, styles: { valign: 'middle', halign: 'center' } },
        { content: 'Otras Ret.', rowSpan: 2, styles: { valign: 'middle', halign: 'center' } },
        { content: 'Totales', rowSpan: 2, styles: { valign: 'middle', halign: 'center' } },
      ],
      [
        { content: 'Neto', styles: { halign: 'center' } },
        { content: 'Iva', styles: { halign: 'center' } },
        { content: 'Neto', styles: { halign: 'center' } },
        { content: 'IVA', styles: { halign: 'center' } },
      ],
    ],
    body,
    theme: 'grid',
    styles: {
      fontSize: 7.5,
      cellPadding: 1.8,
      lineColor: IDUO_BORDER_COLOR,
      lineWidth: 0.2,
      textColor: [17, 24, 39],
      valign: 'top',
    },
    headStyles: {
      fillColor: IDUO_HEADER_FILL,
      textColor: [17, 24, 39],
      fontStyle: 'bold',
      lineColor: IDUO_BORDER_COLOR,
      lineWidth: 0.25,
    },
    columnStyles: {
      0: { halign: 'left', cellWidth: 28 },
      1: { halign: 'right' },
      2: { halign: 'right' },
      3: { halign: 'right' },
      4: { halign: 'right' },
      5: { halign: 'right' },
      6: { halign: 'right' },
      7: { halign: 'right' },
      8: { halign: 'right' },
      9: { halign: 'right' },
      10: { halign: 'right' },
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.row.index === body.length - 1) {
        data.cell.styles.fontStyle = 'bold';
      }
    },
    didDrawPage: (data) => {
      headerDrawer(data.pageNumber);
    },
  });
}

function renderLedgerBookPdf(params: {
  title: string;
  entityColLabel: string;
  ivaColLabel: string;
  empresa: string;
  cuit: string;
  periodLabel: string;
  records: any[];
  retenciones?: any[];
  isSales: boolean;
  filename: string;
}): void {
  const {
    title,
    entityColLabel,
    ivaColLabel,
    empresa,
    cuit,
    periodLabel,
    records,
    retenciones = [],
    isSales,
    filename,
  } = params;

  const doc = new jsPDF('landscape');
  const formatDate = isSales ? formatArDateDDMMYYYY : formatUtcDateDDMMYYYY;
  const ledger = buildBookLedger({ records, retenciones, formatDate });

  const body: string[][] = ledger.rows.map((r) => [
    r.fecha,
    r.comprobante,
    r.numero,
    r.persona,
    r.cuit,
    formatIduoARS(r.netoCents),
    formatIduoARS(r.exentoCents),
    formatIduoARS(r.ivaCents),
    formatIduoARS(r.percepcionesCents),
    formatIduoARS(r.retencionesCents),
    formatIduoARS(r.totalCents),
  ]);

  body.push([
    '',
    '',
    '',
    '',
    'TOTALES',
    formatIduoARS(ledger.totals.netoCents),
    formatIduoARS(ledger.totals.exentoCents),
    formatIduoARS(ledger.totals.ivaCents),
    formatIduoARS(ledger.totals.percepcionesCents),
    formatIduoARS(ledger.totals.retencionesCents),
    formatIduoARS(ledger.totals.totalCents),
  ]);

  const headerDrawer = (pageNumber: number) =>
    drawIduoPageHeader({ doc, title, empresa, cuit, periodLabel, pageNumber });

  autoTable(doc, {
    margin: { top: 36, left: 10, right: 10, bottom: 10 },
    head: [
      [
        'Fecha',
        'Comprobante',
        'Numero',
        entityColLabel,
        'CUIT/DNI',
        'Neto Gravado',
        'Exento',
        ivaColLabel,
        'Percepciones',
        'Retenciones',
        'Total',
      ],
    ],
    body,
    theme: 'grid',
    styles: {
      fontSize: 7.5,
      cellPadding: 1.6,
      lineColor: IDUO_BORDER_COLOR,
      lineWidth: 0.2,
      textColor: [17, 24, 39],
    },
    headStyles: {
      fillColor: IDUO_HEADER_FILL,
      textColor: [17, 24, 39],
      fontStyle: 'bold',
      halign: 'center',
      lineColor: IDUO_BORDER_COLOR,
      lineWidth: 0.25,
    },
    columnStyles: {
      0: { cellWidth: 18, halign: 'left' },
      1: { cellWidth: 26, halign: 'left' },
      2: { cellWidth: 28, halign: 'left' },
      3: { cellWidth: 44, halign: 'left' },
      4: { cellWidth: 23, halign: 'left' },
      5: { halign: 'right' },
      6: { halign: 'right' },
      7: { halign: 'right' },
      8: { halign: 'right' },
      9: { halign: 'right' },
      10: { halign: 'right' },
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.row.index === body.length - 1) {
        data.cell.styles.fontStyle = 'bold';
      }
    },
    didDrawPage: (data) => {
      headerDrawer(data.pageNumber);
    },
  });

  if (isSales) {
    const conceptSummary = buildConceptSummary(records, retenciones);
    renderSummaryTable({
      doc,
      firstColLabel: 'Descripcion',
      rows: conceptSummary.rows,
      totals: conceptSummary.totals,
      headerDrawer,
    });

    const conditionSummary = buildTaxConditionSummary(records, retenciones);
    renderSummaryTable({
      doc,
      firstColLabel: 'Condicion IVA',
      rows: conditionSummary.rows,
      totals: conditionSummary.totals,
      headerDrawer,
    });
  }

  doc.save(filename);
}

export async function exportSubdiarioIvaPdfs(params: {
  month: number;
  year: number;
  ventasData: any[];
  comprasData: any[];
  retencionesData?: any[];
  onProgress?: (msg: string) => void;
}): Promise<void> {
  const { month, year, ventasData, comprasData, retencionesData = [], onProgress } = params;
  const company = getCompanyProfile();
  const mm = String(month).padStart(2, '0');
  const lastDay = String(resolveAfipPeriodLastDay(month, year)).padStart(2, '0');
  const periodLabel = `Periodo: 01/${mm}/${year} - ${lastDay}/${mm}/${year}`;
  const empresa = (company.razonSocial || company.nombreFantasia || '').toUpperCase();
  const cuit = normalizeCuitDigits(company.cuit) || company.cuit;

  onProgress?.('Procesando y tabulando Libro IVA Ventas...');
  renderLedgerBookPdf({
    title: 'LIBRO I.V.A. - VENTAS',
    entityColLabel: 'Persona',
    ivaColLabel: 'IVA',
    empresa,
    cuit,
    periodLabel,
    records: ventasData,
    retenciones: retencionesData,
    isSales: true,
    filename: `Subdiario_Ventas_${year}_${mm}.pdf`,
  });

  onProgress?.('Procesando y tabulando Libro IVA Compras...');
  renderLedgerBookPdf({
    title: 'LIBRO I.V.A. - COMPRAS',
    entityColLabel: 'Proveedor',
    ivaColLabel: 'IVA Crédito',
    empresa,
    cuit,
    periodLabel,
    records: comprasData,
    isSales: false,
    filename: `Subdiario_Compras_${year}_${mm}.pdf`,
  });
}
