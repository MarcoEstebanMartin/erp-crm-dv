import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getCompanyProfile } from './companyProfile';
import { SCALE, divRoundHalfUp, parseScaledBigInt } from './exactStockMath';

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

export function toCentsBigInt(value: string | number | null | undefined): bigint {
  return divRoundHalfUp(parseScaledBigInt(value) * 100n, SCALE);
}

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

function buildRows(
  records: any[],
  isSales: boolean,
): string[][] {
  return (records || []).map((row) => {
    const sign = BigInt(row?.sign === -1 ? -1 : 1);
    const fecha = isSales
      ? formatArDateDDMMYYYY(row.fecha)
      : formatUtcDateDDMMYYYY(row.fecha);
    return [
      fecha,
      row.tipo || '',
      row.numero || '',
      row.persona?.name || '',
      row.persona?.cuit || '',
      formatCentsARS(toCentsBigInt(row.neto) * sign, true),
      '$ 0,00',
      formatCentsARS(toCentsBigInt(row.iva) * sign, true),
      formatCentsARS(toCentsBigInt(row.percepciones) * sign, true),
      '$ 0,00',
      formatCentsARS(toCentsBigInt(row.total) * sign, true),
    ];
  });
}

export async function exportSubdiarioIvaPdfs(params: {
  month: number;
  year: number;
  ventasData: any[];
  comprasData: any[];
  onProgress?: (msg: string) => void;
}): Promise<void> {
  const { month, year, ventasData, comprasData, onProgress } = params;
  const company = getCompanyProfile();
  const mm = String(month).padStart(2, '0');
  const lastDay = String(resolveAfipPeriodLastDay(month, year)).padStart(2, '0');
  const periodLabel = `Periodo: 01/${mm}/${year} - ${lastDay}/${mm}/${year}`;
  const companyLabel = `Empresa: ${company.nombreFantasia} — ${company.razonSocial} (CUIT: ${company.cuit})`;

  onProgress?.('Procesando y tabulando Libro IVA Ventas...');
  const ventasRows = buildRows(ventasData, true);
  const docVentas = new jsPDF('landscape');
  docVentas.setFontSize(15);
  docVentas.text('LIBRO I.V.A. - VENTAS', 148, 15, { align: 'center' });
  docVentas.setFontSize(10);
  docVentas.text(companyLabel, 14, 24);
  docVentas.text(periodLabel, 14, 30);

  autoTable(docVentas, {
    startY: 35,
    head: [['Fecha', 'Comprobante', 'Numero', 'Persona', 'CUIT/DNI', 'Neto Gravado', 'Exento', 'IVA', 'Percepciones', 'Retenciones', 'Total']],
    body: ventasRows,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [229, 231, 235], textColor: [17, 24, 39], fontStyle: 'bold' },
  });
  docVentas.save(`Subdiario_Ventas_${year}_${mm}.pdf`);

  onProgress?.('Procesando y tabulando Libro IVA Compras...');
  const comprasRows = buildRows(comprasData, false);
  const docCompras = new jsPDF('landscape');
  docCompras.setFontSize(15);
  docCompras.text('LIBRO I.V.A. - COMPRAS', 148, 15, { align: 'center' });
  docCompras.setFontSize(10);
  docCompras.text(companyLabel, 14, 24);
  docCompras.text(periodLabel, 14, 30);

  autoTable(docCompras, {
    startY: 35,
    head: [['Fecha', 'Comprobante', 'Numero', 'Proveedor', 'CUIT', 'Neto Gravado', 'Exento', 'IVA Crédito', 'Percepciones', 'Retenciones', 'Total']],
    body: comprasRows,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [229, 231, 235], textColor: [17, 24, 39], fontStyle: 'bold' },
  });
  docCompras.save(`Subdiario_Compras_${year}_${mm}.pdf`);
}
