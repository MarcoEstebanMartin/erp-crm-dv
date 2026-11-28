export interface WeeklyPulsePurchaseItem {
  id: string;
  source: 'AUTO_INVOICE' | 'AUTO_PO' | 'MANUAL';
  sourceId?: number;
  company: string;
  date: string;
  invoiceDate?: string | null;
  invoiceNumber?: string | null;
  amount: number;
  excluded?: boolean;
}

export interface WeeklyPulseSaleRow {
  id: string;
  source: 'AUTO' | 'MANUAL';
  locality: string;
  date: string;
  amountA: number;
  amountX: number;
  total: number;
  ordersCount?: number;
}

export interface WeeklyPulseSummary {
  openingCredit: number;
  weekPurchasesTotal: number;
  totalPurchasesWithCredit: number;
  resultBuffer: number;
  salesA: number;
  salesX: number;
  salesTotal: number;
  salesAPct: number;
  salesXPct: number;
  weekNetBalance: number;
  closingCredit: number;
  status: 'AVAILABLE' | 'OVERBOUGHT' | 'BALANCED';
}

export interface WeeklyPulseHistoryItem {
  weekStart: string;
  weekEnd: string;
  salesTotal: number;
  weekPurchasesTotal: number;
  resultBuffer: number;
  closingCredit: number;
  status: WeeklyPulseSummary['status'];
}

export interface WeeklyPulseData {
  weekStart: string;
  weekEnd: string;
  isManualOpeningCredit: boolean;
  manualOpeningCredit: number | null;
  summary: WeeklyPulseSummary;
  purchases: WeeklyPulsePurchaseItem[];
  sales: WeeklyPulseSaleRow[];
  excludedSourceKeys: string[];
  habitualCompanies?: string[];
  suggestedCompanies?: string[];
  history: WeeklyPulseHistoryItem[];
}

export interface SaveWeeklyPulsePayload {
  weekStart: string;
  resultBuffer: number;
  manualOpeningCredit?: number | null;
  manualPurchases: Array<{ id: string; company: string; date: string; amount: number }>;
  manualSales: Array<{ id: string; locality: string; date: string; amountA: number; amountX: number }>;
  excludedSourceKeys: string[];
}

export function formatPeso(value: number): string {
  const rounded = Math.round(value || 0);
  const absStr = Math.abs(rounded).toLocaleString('es-AR');
  return rounded < 0 ? `-$${absStr}` : `$${absStr}`;
}

export function normalizePulseCompanyKey(name: string): string {
  return name.trim().toUpperCase().replace(/\s+/g, ' ');
}

export function parseArIntegerInput(raw: string): number | null {
  const cleaned = raw.trim().replace(/\$/g, '').replace(/\./g, '').replace(',', '.');
  if (!cleaned) return 0;
  const num = Number(cleaned);
  return Number.isFinite(num) ? Math.round(num) : null;
}

export function formatShortArDate(iso: string): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso || '-';
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}

export function formatWeekRangeLabel(weekStart: string, weekEnd: string): string {
  return `Lun ${formatShortArDate(weekStart)} – Sáb ${formatShortArDate(weekEnd)}`;
}

export function shiftMondayIso(mondayIso: string, deltaWeeks: number): string {
  const [y, m, d] = mondayIso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + deltaWeeks * 7));
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

export function getCurrentMondayArIso(): string {
  const arIso = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  const [y, m, d] = arIso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const dow = dt.getUTCDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(Date.UTC(y, m - 1, d + diff));
  return `${monday.getUTCFullYear()}-${String(monday.getUTCMonth() + 1).padStart(2, '0')}-${String(monday.getUTCDate()).padStart(2, '0')}`;
}

export function buildWeeklyPulseTsv(data: WeeklyPulseData): string {
  const lines: string[] = [];
  lines.push(`PULSO SEMANAL\t${formatWeekRangeLabel(data.weekStart, data.weekEnd)}`);
  lines.push('');
  lines.push('COMPRAS Y GASTOS\tFecha\tImporte');
  for (const p of data.purchases) {
    if (p.excluded) continue;
    lines.push(`${p.company}\t${formatShortArDate(p.date)}\t${Math.round(p.amount)}`);
  }
  lines.push(`CRÉDITO ANTERIOR\t\t${Math.round(data.summary.openingCredit)}`);
  lines.push(`TOTAL COMPRAS + CRÉDITO\t\t${Math.round(data.summary.totalPurchasesWithCredit)}`);
  lines.push(`RESULTADO\t\t${Math.round(data.summary.resultBuffer)}`);
  lines.push('');
  lines.push('LOCALIDAD\tImporte A\tImporte X\tTotal');
  for (const s of data.sales) {
    lines.push(`${s.locality}\t${Math.round(s.amountA)}\t${Math.round(s.amountX)}\t${Math.round(s.total)}`);
  }
  lines.push(`TOTAL VENTAS\t${Math.round(data.summary.salesA)}\t${Math.round(data.summary.salesX)}\t${Math.round(data.summary.salesTotal)}`);
  lines.push(`CRÉDITO CIERRE\t\t\t${Math.round(data.summary.closingCredit)}`);
  return lines.join('\n');
}
