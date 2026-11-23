import {
  getWhatsAppLink,
  normalizePhoneticClientText,
  tokenizePhoneticClientQuery,
  type TokenizedClientQuery,
} from '../admin/clientsHelpers';
import {
  extractCleanLotNumber,
  formatCleanExpirationDate,
  isSentinelExpiration,
} from '../stock/lotLabel';

export { getWhatsAppLink, tokenizePhoneticClientQuery };

const PROVIDER_SOURCE_TYPES = new Set([
  'SUPPLIER_INVOICE',
  'SUPPLIER_INVOICE_REVERSAL',
  'SUPPLIER_PAYMENT',
]);

export function parseExactCents(value: unknown): number {
  if (value === null || value === undefined || value === '') return 0;
  const raw = String(value).trim().replace(/\s+/g, '');
  if (!raw) return 0;
  const match = raw.match(/^([+-])?(\d+)(?:\.(\d+))?$/);
  if (!match) {
    const num = Number(raw);
    return Number.isFinite(num) ? Math.round(num * 100) : 0;
  }
  const sign = match[1] === '-' ? -1 : 1;
  const whole = Number(match[2] || 0);
  const fracRaw = (match[3] || '').padEnd(3, '0');
  const twoDigits = Number(fracRaw.slice(0, 2));
  const roundUp = Number(fracRaw[2] || '0') >= 5 ? 1 : 0;
  return sign * (whole * 100 + twoDigits + roundUp);
}

export function formatCentsArs(cents: number, showZero = true): string {
  if (!Number.isFinite(cents) || cents === 0) return showZero ? '$0' : '';
  const absCents = Math.abs(cents);
  const sign = cents < 0 ? '-' : '';
  if (absCents % 100 === 0) {
    return `${sign}$${Math.trunc(absCents / 100).toLocaleString('es-AR')}`;
  }
  return `${sign}$${(absCents / 100).toLocaleString('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatMoneyArs(value: unknown, showZero = true): string {
  return formatCentsArs(parseExactCents(value), showZero);
}

export function formatCuitDisplay(cuit?: string | null): string | null {
  if (!cuit) return null;
  const trimmed = String(cuit).trim();
  if (!trimmed) return null;
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length === 11) {
    return `${digits.slice(0, 2)}-${digits.slice(2, 10)}-${digits.slice(10)}`;
  }
  return trimmed;
}

export function matchesProviderSearchQuery(
  provider: any,
  rawQueryOrTokens: string | TokenizedClientQuery,
): boolean {
  const query =
    typeof rawQueryOrTokens === 'string'
      ? tokenizePhoneticClientQuery(rawQueryOrTokens)
      : rawQueryOrTokens;

  if (query.tokens.length === 0 && query.digitTokens.length === 0) {
    return true;
  }

  const cuitRaw = String(provider?.cuit || '');
  const cuitDigits = cuitRaw.replace(/\D/g, '');
  const cuitDashed =
    cuitDigits.length === 11
      ? `${cuitDigits.slice(0, 2)}-${cuitDigits.slice(2, 10)}-${cuitDigits.slice(10)}`
      : '';
  const phoneRaw = String(provider?.phone || '');
  const phoneDigits = phoneRaw.replace(/\D/g, '');
  const contacts = Array.isArray(provider?.contacts) ? provider.contacts : [];
  const contactsText = contacts
    .map((c: any) => `${c?.name || ''} ${c?.role || ''} ${c?.phone || ''} ${c?.email || ''}`)
    .join(' ');
  const contactsDigits = contacts.map((c: any) => String(c?.phone || '').replace(/\D/g, '')).join(' ');
  const digitsHaystack = `${cuitDigits} ${phoneDigits} ${contactsDigits}`;

  const normalizedTarget = normalizePhoneticClientText(
    `${provider?.name || ''} ${cuitRaw} ${cuitDigits} ${cuitDashed} ${provider?.rubro || ''} ${provider?.city || ''} ${provider?.address || ''} ${provider?.email || ''} ${phoneRaw} ${phoneDigits} ${contactsText}`,
  );

  const matchesText = query.tokens.every((token) => {
    if (normalizedTarget.includes(token)) return true;
    const tokenDigits = token.replace(/\D/g, '');
    return tokenDigits.length >= 3 && /^[\d.\-]+$/.test(token) && digitsHaystack.includes(tokenDigits);
  });

  if (!matchesText) return false;
  if (query.digitTokens.length === 0) return true;
  return query.digitTokens.every((dt) => digitsHaystack.includes(dt));
}

export function computeProviderPayableSummary(provider: any) {
  let payableCents = 0;
  let favorCents = 0;

  if (provider?.payableBalance !== undefined || provider?.favorBalance !== undefined) {
    payableCents = Math.max(0, parseExactCents(provider.payableBalance));
    favorCents = Math.max(0, parseExactCents(provider.favorBalance));
  } else if (!provider?.isClient) {
    const netCents = parseExactCents(provider?.outstandingBalance);
    if (netCents < 0) payableCents = Math.abs(netCents);
    else if (netCents > 0) favorCents = netCents;
  }

  return {
    payableCents,
    favorCents,
    payableAmount: payableCents / 100,
    favorAmount: favorCents / 100,
    productsCount: Number(provider?.productsCount || 0),
    pendingInvoicesCount: Number(provider?.pendingInvoicesCount || 0),
    overdueInvoicesCount: Number(provider?.overdueInvoicesCount || 0),
  };
}

function isProviderEntry(item: any): boolean {
  if (item?.sourceType && PROVIDER_SOURCE_TYPES.has(String(item.sourceType))) return true;
  if (item?.sourceType === 'TAX_WITHHOLDING' && item?.type === 'DEBIT') return true;
  const idStr = String(item?.id || '');
  const refStr = String(item?.reference || '');
  const descStr = String(item?.description || '');
  return (
    idStr.startsWith('supplier-invoice-') ||
    refStr.startsWith('Pago #') ||
    refStr.startsWith('Retención Practicada') ||
    descStr.startsWith('Compra -') ||
    descStr.startsWith('Reversión por eliminación de Factura')
  );
}

function resolveKindLabel(
  item: any,
): 'Factura' | 'Nota de Crédito' | 'Pago' | 'Retención' | 'Anulación' | 'Ajuste' {
  if (item?.sourceType === 'SUPPLIER_INVOICE') return 'Factura';
  if (item?.sourceType === 'SUPPLIER_INVOICE_REVERSAL') return 'Anulación';
  if (item?.sourceType === 'SUPPLIER_PAYMENT') return 'Pago';
  if (
    (item?.sourceType === 'TAX_WITHHOLDING' && item?.type === 'DEBIT') ||
    String(item?.reference || '').startsWith('Retención Practicada')
  ) {
    return 'Retención';
  }
  if (item?.sourceType === 'RECONCILIATION_ADJUSTMENT' || item?.sourceType === 'LEGACY_ADJUSTMENT') {
    return 'Ajuste';
  }
  if (String(item?.reference || '').startsWith('Nota de Crédito')) {
    return 'Nota de Crédito';
  }
  return item?.type === 'CREDIT' ? 'Factura' : 'Pago';
}

export interface ProviderStatementViewRow {
  id?: string;
  date: string;
  reference: string;
  description: string;
  kindLabel: 'Factura' | 'Nota de Crédito' | 'Pago' | 'Retención' | 'Anulación' | 'Ajuste';
  compraCents: number;
  pagoCents: number;
  compraAmount: number;
  pagoAmount: number;
  runningPayableCents: number;
  runningPayable: number;
}

export function buildProviderLedgerStatement(
  ledger: any[],
  provider?: { isClient?: boolean } | null,
): { rows: ProviderStatementViewRow[]; finalPayableCents: number; finalPayableAmount: number } {
  const scoped = provider?.isClient ? (ledger || []).filter(isProviderEntry) : ledger || [];
  let runningPayableCents = 0;

  const rows: ProviderStatementViewRow[] = scoped.map((item) => {
    const amtCents = Math.max(0, parseExactCents(item?.amount));
    const isPurchaseCredit = item?.type === 'CREDIT';
    const compraCents = isPurchaseCredit ? amtCents : 0;
    const pagoCents = !isPurchaseCredit ? amtCents : 0;
    runningPayableCents += compraCents - pagoCents;

    return {
      id: item?.id,
      date: item?.date || '',
      reference: String(item?.reference || ''),
      description: String(item?.description || ''),
      kindLabel: resolveKindLabel(item),
      compraCents,
      pagoCents,
      compraAmount: compraCents / 100,
      pagoAmount: pagoCents / 100,
      runningPayableCents,
      runningPayable: runningPayableCents / 100,
    };
  });

  return {
    rows,
    finalPayableCents: runningPayableCents,
    finalPayableAmount: runningPayableCents / 100,
  };
}

export function buildEmptyProviderDraft() {
  return {
    id: 0, name: '', cuit: '', address: '', city: '', phone: '', email: '',
    paymentTermDays: 30, rubro: '', providerType: 'MERCADERIA', isActive: true, contacts: [],
  };
}

export function addDaysIso(baseIso: string, days: number): string {
  const safeDays = Number.isFinite(Number(days)) ? Math.trunc(Number(days)) : 30;
  const match = String(baseIso || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  const utcMs = match
    ? Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + safeDays)
    : Date.now() + safeDays * 86400000;
  return new Date(utcMs).toISOString().split('T')[0];
}

export function formatPurchaseOrderLotsSummary(order: any): string[] {
  const movements = Array.isArray(order?.stockMovements) ? order.stockMovements : [];
  if (movements.length === 0) return ['Sin lote'];
  const labels = new Set<string>();
  for (const mv of movements) {
    const lot = mv?.productLot;
    const cleanLot = extractCleanLotNumber(lot?.lotNumber);
    const hasRealLot = cleanLot.toUpperCase() !== 'S/L';
    const hasRealExp = !isSentinelExpiration(lot?.expirationDate);
    if (!hasRealLot && !hasRealExp) continue;
    const lotPart = hasRealLot ? `Lote ${cleanLot}` : 'Sin lote';
    const expPart = hasRealExp ? `Vto ${formatCleanExpirationDate(lot?.expirationDate)}` : '';
    labels.add([lotPart, expPart].filter(Boolean).join(' · '));
  }
  return labels.size > 0 ? [...labels] : ['Sin lote'];
}

export function computeSupplierInvoicesMetrics(invoices: any[]) {
  let totalDeuda = 0, vencidasCount = 0, totalVencidas = 0, proximasCount = 0, totalProximas = 0, enTransitoCount = 0;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const in7Days = new Date(); in7Days.setDate(today.getDate() + 7); in7Days.setHours(23, 59, 59, 999);
  for (const inv of invoices || []) {
    if (inv.receptionStatus === 'IN_TRANSIT') enTransitoCount++;
    if (inv.status === 'PAID') continue;
    const pending = Math.max(0, (parseExactCents(inv.totalAmount) - parseExactCents(inv.paidAmount)) / 100);
    totalDeuda += pending;
    if (inv.dueDate) {
      const due = new Date(inv.dueDate);
      if (due < today) { vencidasCount++; totalVencidas += pending; }
      else if (due >= today && due <= in7Days) { proximasCount++; totalProximas += pending; }
    }
  }
  return { totalDeuda, vencidasCount, totalVencidas, proximasCount, totalProximas, enTransitoCount };
}

export interface InvoiceDueDaysInfo {
  label: string;
  tone: 'paid' | 'overdue' | 'warning' | 'neutral';
  diffDays: number | null;
}

export function computeInvoiceDueDaysInfo(dueDate?: string | null, status?: string, now = new Date()): InvoiceDueDaysInfo {
  if (status === 'PAID') return { label: 'Saldada', tone: 'paid', diffDays: null };
  if (!dueDate) return { label: 'S/D', tone: 'neutral', diffDays: null };
  const due = new Date(dueDate);
  if (Number.isNaN(due.getTime())) return { label: 'S/D', tone: 'neutral', diffDays: null };
  const dueUtc = Date.UTC(due.getUTCFullYear(), due.getUTCMonth(), due.getUTCDate());
  const todayUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.round((dueUtc - todayUtc) / 86400000);
  if (diffDays < 0) return { label: `Vencida ${Math.abs(diffDays)}d`, tone: 'overdue', diffDays };
  if (diffDays === 0) return { label: 'Vence hoy', tone: 'warning', diffDays: 0 };
  if (diffDays <= 7) return { label: `En ${diffDays}d`, tone: 'warning', diffDays };
  return { label: `En ${diffDays}d`, tone: 'neutral', diffDays };
}
