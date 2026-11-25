export interface ResumenMovementLike {
  id?: string;
  sourceType?: string;
  description?: string;
  reference?: string;
  receiptNumber?: string | null;
  movementId?: number | string | null;
  debit?: number;
  credit?: number;
}

export interface ResumenLedgerRow {
  id: string;
  movementId: number | string | null;
  date: Date;
  isPureDate: boolean;
  reference: string;
  description: string;
  sourceType?: string;
  receiptNumber: string | null;
  billingType: string;
  debit: number;
  credit: number;
  balance: number;
  isVoided?: boolean;
  voidReason?: string | null;
  metadata: Record<string, any>;
}

export type ResumenBranchFilter = 'ALL' | 'OFFICIAL' | 'INTERNAL';
export type ResumenDateRange = '7days' | '30days' | '90days' | 'all' | 'custom';

export interface BuildResumenRowsOptions {
  branchFilter: ResumenBranchFilter;
  dateRange: ResumenDateRange;
  customStart?: string;
  customEnd?: string;
  includeVoided?: boolean;
  now?: Date;
}

export interface BuildResumenRowsResult {
  rows: ResumenLedgerRow[];
  priorBalance: number;
  hasPriorEntries: boolean;
  hasVoidedEntries: boolean;
  finalBalance: number;
}

function formatInvoiceNumberShort(text: string): string {
  return text.replace(/\b(\d{4,5})[-–—](\d{6,8})\b/g, (_match, pv, num) => {
    const shortPv = String(Number(pv)).padStart(4, '0');
    const shortNum = String(Number(num)).padStart(4, '0');
    return `${shortPv}-${shortNum}`;
  });
}

function resolveReceiptNumber(tx: ResumenMovementLike): string | null {
  const direct = String(tx.receiptNumber || '').trim();
  if (direct) return direct;

  const desc = String(tx.description || '').trim();
  const descMatch = desc.match(/Recibo(?:\s+digital\s+en\s+calle)?\s+(?:N°\s*)?(REC-[A-Z0-9-]+)/i);
  if (descMatch) return descMatch[1];

  const ref = String(tx.reference || '').trim();
  const refRecMatch = ref.match(/^(REC-[A-Z0-9-]+)$/i);
  if (refRecMatch) return refRecMatch[1];

  if (tx.movementId !== undefined && tx.movementId !== null && String(tx.movementId).trim() !== '') {
    return `REC-${String(tx.movementId).padStart(5, '0')}`;
  }

  const idMatch = String(tx.id || '').match(/^transaction-(\d+)$/);
  if (idMatch) {
    return `REC-${idMatch[1].padStart(5, '0')}`;
  }

  return null;
}

export function formatMovementLabel(txOrDescription: ResumenMovementLike | string): string {
  const tx: ResumenMovementLike =
    typeof txOrDescription === 'string' ? { description: txOrDescription } : txOrDescription;
  const text = String(tx.description || '').trim();

  const isCollectionReceipt =
    tx.sourceType === 'COLLECTION_RECEIPT' ||
    (Number(tx.credit || 0) > 0 && Number(tx.debit || 0) === 0 && String(tx.id || '').startsWith('transaction-'));

  if (isCollectionReceipt) {
    const receiptNum = resolveReceiptNumber(tx);
    return receiptNum || 'REC';
  }

  const receiptMatch = text.match(/^Recibo(?:\s+digital\s+en\s+calle)?\s+(?:N°\s*)?([A-Z0-9-]+)(?:\s*[-–—].*)?$/i);
  if (receiptMatch) {
    return receiptMatch[1];
  }

  const mainPart = text.split(/\s+[-–—]\s+(?![\d])/)[0] || text;
  return formatInvoiceNumberShort(mainPart.trim()).replace(/^(?:Factura|Fc\.?)\s+/i, '').trim();
}

export function formatSignedCurrency(amount: number): string {
  const rounded = Math.round(Number(amount || 0));
  if (rounded === 0) return '$0';
  const absFormatted = Math.abs(rounded).toLocaleString('es-AR');
  return rounded < 0 ? `-$${absFormatted}` : `$${absFormatted}`;
}

export function buildResumenRows(ledger: any[], options: BuildResumenRowsOptions): BuildResumenRowsResult {
  const hasVoidedEntries = (ledger || []).some((item: any) => Boolean(item?.isVoided));

  let combined: ResumenLedgerRow[] = (ledger || [])
    .filter((item: any) => options.includeVoided || !item?.isVoided)
    .map((item: any) => {
    const isDebit = item.type === 'DEBIT';
    const idStr = String(item.id || '');
    const isPureDate =
      idStr.startsWith('withholding-') ||
      idStr.startsWith('supplier-invoice-') ||
      (typeof item.date === 'string' && item.date.includes('T00:00:00.000Z'));

    return {
      id: idStr,
      movementId: item.movementId ?? null,
      date: new Date(item.date),
      isPureDate,
      reference: String(item.reference || ''),
      description: String(item.description || ''),
      sourceType: item.sourceType,
      receiptNumber: item.receiptNumber ?? null,
      billingType: item.billingType || item.metadata?.billingType || 'ALL',
      debit: isDebit ? Number(item.amount || 0) : 0,
      credit: !isDebit ? Number(item.amount || 0) : 0,
      balance: 0,
      isVoided: Boolean(item.isVoided),
      voidReason: item.voidReason ?? null,
      metadata: item.metadata ? { ...item.metadata, movementId: item.movementId } : { movementId: item.movementId },
    };
  });

  if (options.branchFilter !== 'ALL') {
    combined = combined.filter((t) => {
      const isOfficialDesc = t.description.includes('Factura A') || t.description.includes('Factura B');
      if (options.branchFilter === 'OFFICIAL') {
        return t.billingType === 'OFFICIAL' || t.billingType === 'AFIP' || isOfficialDesc;
      }
      return t.billingType === 'INTERNAL' || !isOfficialDesc;
    });
  }

  combined.sort((a, b) => a.date.getTime() - b.date.getTime());

  let runningCents = 0;
  combined = combined.map((t) => {
    runningCents += Math.round(t.debit * 100) - Math.round(t.credit * 100);
    return { ...t, balance: runningCents / 100 };
  });

  const finalBalance = runningCents / 100;

  let startCutoff: Date | null = null;
  let endCutoff: Date | null = null;

  if (options.dateRange === '7days' || options.dateRange === '30days' || options.dateRange === '90days') {
    const days = options.dateRange === '7days' ? 7 : options.dateRange === '30days' ? 30 : 90;
    const cutoff = new Date(options.now ? options.now.getTime() : Date.now());
    cutoff.setDate(cutoff.getDate() - days);
    startCutoff = cutoff;
  } else if (options.dateRange === 'custom' && options.customStart && options.customEnd) {
    startCutoff = new Date(options.customStart);
    endCutoff = new Date(options.customEnd);
    endCutoff.setHours(23, 59, 59, 999);
  }

  let priorBalance = 0;
  let hasPriorEntries = false;
  const rows: ResumenLedgerRow[] = [];

  for (const row of combined) {
    if (startCutoff && row.date < startCutoff) {
      priorBalance = row.balance;
      hasPriorEntries = true;
      continue;
    }
    if (endCutoff && row.date > endCutoff) {
      continue;
    }
    rows.push(row);
  }

  return { rows, priorBalance, hasPriorEntries, hasVoidedEntries, finalBalance };
}
