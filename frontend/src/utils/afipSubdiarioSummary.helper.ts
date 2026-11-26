import { SCALE, divRoundHalfUp, parseScaledBigInt } from './exactStockMath';

export type TaxConditionKey =
  | 'CONSUMIDOR_FINAL'
  | 'EXENTO'
  | 'MONOTRIBUTO'
  | 'RESPONSABLE_INSCRIPTO';

export const TAX_CONDITION_ORDER: Array<{ key: TaxConditionKey; label: string }> = [
  { key: 'CONSUMIDOR_FINAL', label: 'Consumidor Final' },
  { key: 'EXENTO', label: 'Exento' },
  { key: 'MONOTRIBUTO', label: 'Monotributo' },
  { key: 'RESPONSABLE_INSCRIPTO', label: 'Responsable\nInscripto' },
];

export interface SubdiarioBookRow {
  sortTime: number;
  sortNum: string;
  fecha: string;
  comprobante: string;
  numero: string;
  persona: string;
  cuit: string;
  netoCents: bigint;
  exentoCents: bigint;
  ivaCents: bigint;
  percepcionesCents: bigint;
  retencionesCents: bigint;
  totalCents: bigint;
}

export interface SubdiarioBookTotals {
  netoCents: bigint;
  exentoCents: bigint;
  ivaCents: bigint;
  percepcionesCents: bigint;
  retencionesCents: bigint;
  totalCents: bigint;
}

export interface TriLineMetric {
  pos: bigint;
  neg: bigint;
  net: bigint;
}

export interface SummaryRowMetrics {
  label: string;
  exento: TriLineMetric;
  neto21: TriLineMetric;
  iva21: TriLineMetric;
  percepIva: TriLineMetric;
  retIva: TriLineMetric;
  otrasPercep: TriLineMetric;
  otrasRet: TriLineMetric;
  total: TriLineMetric;
}

export function toCentsBigInt(value: string | number | null | undefined): bigint {
  return divRoundHalfUp(parseScaledBigInt(value) * 100n, SCALE);
}

export function formatIduoARS(cents: bigint): string {
  const isNeg = cents < 0n;
  const abs = isNeg ? -cents : cents;
  const pesos = abs / 100n;
  const rem = abs % 100n;
  const grouped = pesos.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const dec = rem.toString().padStart(2, '0');
  return isNeg ? `$ -${grouped},${dec}` : `$ ${grouped},${dec}`;
}

export function formatPlainDecimalARS(cents: bigint): string {
  const isNeg = cents < 0n;
  const abs = isNeg ? -cents : cents;
  const pesos = abs / 100n;
  const rem = abs % 100n;
  const grouped = pesos.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const dec = rem.toString().padStart(2, '0');
  return isNeg ? `-${grouped},${dec}` : `${grouped},${dec}`;
}

export function formatTriLine(metric: TriLineMetric): string {
  return [
    formatPlainDecimalARS(metric.pos),
    formatPlainDecimalARS(metric.neg),
    formatPlainDecimalARS(metric.net),
  ].join('\n');
}

export function formatVoucherDisplay(
  tipoRaw: string | null | undefined,
  numeroRaw: string | null | undefined,
): { comprobante: string; numero: string } {
  const tipo = String(tipoRaw || '').trim();
  const num = String(numeroRaw || '').trim();
  const upper = tipo.toUpperCase();

  if (upper.startsWith('FACTURA_')) {
    const letter = upper.replace('FACTURA_', '').trim();
    return { comprobante: 'Factura', numero: letter ? `${letter} ${num}` : num };
  }
  if (upper.startsWith('NOTA_CREDITO_')) {
    const letter = upper.replace('NOTA_CREDITO_', '').trim();
    return { comprobante: 'Nota de Credito', numero: letter ? `${letter} ${num}` : num };
  }
  if (upper.startsWith('NOTA_DEBITO_')) {
    const letter = upper.replace('NOTA_DEBITO_', '').trim();
    return { comprobante: 'Nota de Debito', numero: letter ? `${letter} ${num}` : num };
  }
  return { comprobante: tipo, numero: num };
}

export function normalizeCuitDigits(cuit?: string | null): string {
  return String(cuit || '').replace(/\D/g, '');
}

export function resolveRowTaxCondition(row: any): TaxConditionKey {
  const raw = String(row?.taxCondition || row?.persona?.taxCondition || '')
    .trim()
    .toUpperCase();
  if (
    raw === 'CONSUMIDOR_FINAL' ||
    raw === 'EXENTO' ||
    raw === 'MONOTRIBUTO' ||
    raw === 'RESPONSABLE_INSCRIPTO'
  ) {
    return raw;
  }
  const cuitDigits = normalizeCuitDigits(row?.persona?.cuit);
  return cuitDigits.length === 11 ? 'RESPONSABLE_INSCRIPTO' : 'CONSUMIDOR_FINAL';
}

function emptyTri(): TriLineMetric {
  return { pos: 0n, neg: 0n, net: 0n };
}

function createEmptySummaryRow(label: string): SummaryRowMetrics {
  return {
    label,
    exento: emptyTri(),
    neto21: emptyTri(),
    iva21: emptyTri(),
    percepIva: emptyTri(),
    retIva: emptyTri(),
    otrasPercep: emptyTri(),
    otrasRet: emptyTri(),
    total: emptyTri(),
  };
}

function addTriValue(target: TriLineMetric, signedValue: bigint, isCreditNote: boolean): void {
  if (isCreditNote) {
    target.neg += signedValue;
  } else {
    target.pos += signedValue;
  }
  target.net += signedValue;
}

function mergeSummaryRows(target: SummaryRowMetrics, source: SummaryRowMetrics): void {
  const fields: Array<keyof Omit<SummaryRowMetrics, 'label'>> = [
    'exento',
    'neto21',
    'iva21',
    'percepIva',
    'retIva',
    'otrasPercep',
    'otrasRet',
    'total',
  ];
  for (const field of fields) {
    target[field].pos += source[field].pos;
    target[field].neg += source[field].neg;
    target[field].net += source[field].net;
  }
}

export function buildBookLedger(params: {
  records: any[];
  retenciones?: any[];
  formatDate: (d: Date | string) => string;
}): { rows: SubdiarioBookRow[]; totals: SubdiarioBookTotals } {
  const { records, retenciones = [], formatDate } = params;
  const rows: SubdiarioBookRow[] = [];

  for (const row of records || []) {
    const sign = BigInt(row?.sign === -1 ? -1 : 1);
    const netoCents = toCentsBigInt(row?.neto) * sign;
    const ivaCents = toCentsBigInt(row?.iva) * sign;
    const percepIibbCents = toCentsBigInt(row?.percepciones) * sign;
    const percepIvaCents = toCentsBigInt(row?.percepcionesIva) * sign;
    const percepcionesCents = percepIibbCents + percepIvaCents;
    const totalCents = toCentsBigInt(row?.total) * sign;
    const display = formatVoucherDisplay(row?.tipo, row?.numero);
    const parsedTime = new Date(row?.fecha).getTime();

    rows.push({
      sortTime: Number.isNaN(parsedTime) ? 0 : parsedTime,
      sortNum: String(row?.numero || ''),
      fecha: formatDate(row?.fecha),
      comprobante: display.comprobante,
      numero: display.numero,
      persona: String(row?.persona?.name || ''),
      cuit: normalizeCuitDigits(row?.persona?.cuit),
      netoCents,
      exentoCents: 0n,
      ivaCents,
      percepcionesCents,
      retencionesCents: 0n,
      totalCents,
    });
  }

  for (const ret of retenciones || []) {
    const absAmount = toCentsBigInt(ret?.amount);
    const signedRet = absAmount > 0n ? -absAmount : absAmount;
    const parsedTime = new Date(ret?.fecha).getTime();

    rows.push({
      sortTime: Number.isNaN(parsedTime) ? 0 : parsedTime,
      sortNum: String(ret?.numero || ''),
      fecha: formatDate(ret?.fecha),
      comprobante: String(ret?.tipo || 'Retencion'),
      numero: String(ret?.numero || ''),
      persona: String(ret?.persona?.name || ''),
      cuit: normalizeCuitDigits(ret?.persona?.cuit),
      netoCents: 0n,
      exentoCents: 0n,
      ivaCents: 0n,
      percepcionesCents: 0n,
      retencionesCents: signedRet,
      totalCents: signedRet,
    });
  }

  rows.sort((a, b) => a.sortTime - b.sortTime || a.sortNum.localeCompare(b.sortNum));

  const totals: SubdiarioBookTotals = {
    netoCents: 0n,
    exentoCents: 0n,
    ivaCents: 0n,
    percepcionesCents: 0n,
    retencionesCents: 0n,
    totalCents: 0n,
  };

  for (const r of rows) {
    totals.netoCents += r.netoCents;
    totals.exentoCents += r.exentoCents;
    totals.ivaCents += r.ivaCents;
    totals.percepcionesCents += r.percepcionesCents;
    totals.retencionesCents += r.retencionesCents;
    totals.totalCents += r.totalCents;
  }

  return { rows, totals };
}

export function buildTaxConditionSummary(
  ventasData: any[],
  retencionesData: any[] = [],
): { rows: SummaryRowMetrics[]; totals: SummaryRowMetrics } {
  const byCondition = new Map<TaxConditionKey, SummaryRowMetrics>();
  for (const item of TAX_CONDITION_ORDER) {
    byCondition.set(item.key, createEmptySummaryRow(item.label));
  }

  for (const row of ventasData || []) {
    const key = resolveRowTaxCondition(row);
    const bucket = byCondition.get(key)!;
    const isCredit = row?.sign === -1;
    const sign = isCredit ? -1n : 1n;

    addTriValue(bucket.neto21, toCentsBigInt(row?.neto) * sign, isCredit);
    addTriValue(bucket.iva21, toCentsBigInt(row?.iva) * sign, isCredit);
    addTriValue(bucket.percepIva, toCentsBigInt(row?.percepcionesIva) * sign, isCredit);
    addTriValue(bucket.otrasPercep, toCentsBigInt(row?.percepciones) * sign, isCredit);
    addTriValue(bucket.total, toCentsBigInt(row?.total) * sign, isCredit);
  }

  for (const ret of retencionesData || []) {
    const key = resolveRowTaxCondition(ret);
    const bucket = byCondition.get(key)!;
    const absAmount = toCentsBigInt(ret?.amount);
    const signedRet = absAmount > 0n ? -absAmount : absAmount;
    const isRetIva = String(ret?.taxType || '').toUpperCase() === 'IVA';

    if (isRetIva) {
      addTriValue(bucket.retIva, signedRet, false);
    } else {
      addTriValue(bucket.otrasRet, signedRet, false);
    }
    addTriValue(bucket.total, signedRet, false);
  }

  const rows = TAX_CONDITION_ORDER.map((item) => byCondition.get(item.key)!);
  const totals = createEmptySummaryRow('TOTALES');
  for (const r of rows) {
    mergeSummaryRows(totals, r);
  }
  return { rows, totals };
}

export function buildConceptSummary(
  ventasData: any[],
  retencionesData: any[] = [],
): { rows: SummaryRowMetrics[]; totals: SummaryRowMetrics } {
  const ventasRow = createEmptySummaryRow('VENTAS GRAVADAS 21%');
  const percIvaRow = createEmptySummaryRow('Percep. de IVA RG\n5329');
  const percIibbRow = createEmptySummaryRow('Percep. IIBB');
  const retRowsMap = new Map<string, SummaryRowMetrics>();

  let hasPercIva = false;
  let hasPercIibb = false;

  for (const row of ventasData || []) {
    const isCredit = row?.sign === -1;
    const sign = isCredit ? -1n : 1n;
    const neto = toCentsBigInt(row?.neto) * sign;
    const iva = toCentsBigInt(row?.iva) * sign;
    const pIva = toCentsBigInt(row?.percepcionesIva) * sign;
    const pIibb = toCentsBigInt(row?.percepciones) * sign;

    addTriValue(ventasRow.neto21, neto, isCredit);
    addTriValue(ventasRow.iva21, iva, isCredit);
    addTriValue(ventasRow.total, neto + iva, isCredit);

    if (pIva !== 0n) {
      hasPercIva = true;
      addTriValue(percIvaRow.percepIva, pIva, isCredit);
      addTriValue(percIvaRow.total, pIva, isCredit);
    }
    if (pIibb !== 0n) {
      hasPercIibb = true;
      addTriValue(percIibbRow.otrasPercep, pIibb, isCredit);
      addTriValue(percIibbRow.total, pIibb, isCredit);
    }
  }

  for (const ret of retencionesData || []) {
    const label = String(ret?.tipo || 'Retencion');
    if (!retRowsMap.has(label)) {
      retRowsMap.set(label, createEmptySummaryRow(label));
    }
    const bucket = retRowsMap.get(label)!;
    const absAmount = toCentsBigInt(ret?.amount);
    const signedRet = absAmount > 0n ? -absAmount : absAmount;
    const isRetIva = String(ret?.taxType || '').toUpperCase() === 'IVA';

    if (isRetIva) {
      addTriValue(bucket.retIva, signedRet, false);
    } else {
      addTriValue(bucket.otrasRet, signedRet, false);
    }
    addTriValue(bucket.total, signedRet, false);
  }

  const rows: SummaryRowMetrics[] = [ventasRow];
  if (hasPercIva) rows.push(percIvaRow);
  if (hasPercIibb) rows.push(percIibbRow);
  for (const retRow of retRowsMap.values()) {
    rows.push(retRow);
  }

  const totals = createEmptySummaryRow('TOTALES');
  for (const r of rows) {
    mergeSummaryRows(totals, r);
  }
  return { rows, totals };
}
