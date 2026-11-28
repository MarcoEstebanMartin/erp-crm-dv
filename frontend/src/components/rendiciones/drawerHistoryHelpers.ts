import { formatResponsibleName } from '../../utils/formatters';

export type DrawerKind = 'CENTRAL' | 'DEPOSITO' | 'REPARTIDOR' | 'ADMINISTRACION' | 'VENDEDOR';

export interface DrawerClassification {
  kind: DrawerKind;
  isCentral: boolean;
  isDepo: boolean;
  isRep: boolean;
  isAdmin: boolean;
  badgeLabel: string;
  badgeBg: string;
  badgeColor: string;
  responsibleName: string;
  showRouteNote: boolean;
  activitySummary: string | null;
}

export interface DrawerDateSummary {
  isoDateTime: string;
  primaryLabel: string;
  rangeLabel: string | null;
}

const ADMIN_BRANCH_PATTERN = /^ADMINISTRACI[OÓ]N\b/i;
const LEGACY_ADMIN_SELLER_PATTERN = /^VENDEDOR:\s*(ADMIN|ADMINISTRADOR)\b/i;
const RENDICION_INCOME_PATTERN = /^Ingreso Rendici[oó]n/i;
const RECEIPT_DESC_PATTERN = /recibo|cobranza|cobro|pago/i;

function pluralize(count: number, singular: string, plural: string): string {
  return count === 1 ? `1 ${singular}` : `${count} ${plural}`;
}

/**
 * Resume en una línea compacta qué movimientos reales contiene un arqueo o cobro
 * (ej. "Recibo · Juan Pérez", "2 recibos · 1 venta", "1 gasto").
 */
export function summarizeDrawerActivity(transactions?: any[] | null): string | null {
  if (!Array.isArray(transactions) || transactions.length === 0) return null;

  let receipts = 0;
  let sales = 0;
  let rendiciones = 0;
  let otherIncomes = 0;
  let outcomes = 0;

  for (const t of transactions) {
    if (!t) continue;
    if (t.type === 'OUTCOME') {
      outcomes += 1;
      continue;
    }
    const desc = String(t.description || '').trim();
    if (RENDICION_INCOME_PATTERN.test(desc)) {
      rendiciones += 1;
    } else if (t.orderId != null) {
      sales += 1;
    } else if (t.receiptNumber || t.persona?.name || RECEIPT_DESC_PATTERN.test(desc)) {
      receipts += 1;
    } else {
      otherIncomes += 1;
    }
  }

  if (transactions.length === 1) {
    const only = transactions[0];
    const clientName = String(only?.persona?.name || '').trim();
    const receiptNum = String(only?.receiptNumber || '').trim();
    if (receipts === 1) {
      if (clientName) return `Recibo · ${clientName}`;
      if (receiptNum) return `Recibo ${receiptNum}`;
      return '1 recibo';
    }
    if (sales === 1) {
      return clientName ? `Venta #${only.orderId} · ${clientName}` : `Venta #${only.orderId}`;
    }
    if (rendiciones === 1) return '1 rendición';
    if (outcomes === 1) return '1 gasto';
    return '1 movimiento';
  }

  const parts: string[] = [];
  if (receipts > 0) parts.push(pluralize(receipts, 'recibo', 'recibos'));
  if (sales > 0) parts.push(pluralize(sales, 'venta', 'ventas'));
  if (rendiciones > 0) parts.push(pluralize(rendiciones, 'rendición', 'rendiciones'));
  if (otherIncomes > 0) parts.push(pluralize(otherIncomes, 'ingreso', 'ingresos'));
  if (outcomes > 0) parts.push(pluralize(outcomes, 'gasto', 'gastos'));

  return parts.length > 0 ? parts.join(' · ') : null;
}

export function classifyDrawerHistoryRow(d: any): DrawerClassification {
  const branch = String(d?.branch || '').trim();
  const drawerType = String(d?.drawerType || '').trim().toUpperCase();
  const responsibleName = formatResponsibleName(d);

  const isCentral =
    drawerType === 'CENTRAL' || branch === 'CENTRAL' || branch === 'CONSOLIDADA';
  const isDepo = !isCentral && (drawerType === 'DEPOSITO' || branch === 'DEPOSITO');
  const isRep =
    !isCentral && !isDepo && (drawerType === 'REPARTIDOR' || branch.toUpperCase().startsWith('REPARTIDOR'));

  const isAdmin =
    !isCentral &&
    !isDepo &&
    !isRep &&
    (drawerType === 'ADMINISTRACION' ||
      ADMIN_BRANCH_PATTERN.test(branch) ||
      LEGACY_ADMIN_SELLER_PATTERN.test(branch) ||
      responsibleName.toLowerCase() === 'admin');

  const activitySummary = isCentral ? null : summarizeDrawerActivity(d?.transactions);

  if (isCentral) {
    return {
      kind: 'CENTRAL',
      isCentral: true,
      isDepo: false,
      isRep: false,
      isAdmin: false,
      badgeLabel: 'Caja Grande',
      badgeBg: '#fef3c7',
      badgeColor: '#92400e',
      responsibleName,
      showRouteNote: false,
      activitySummary: null,
    };
  }

  if (isDepo) {
    return {
      kind: 'DEPOSITO',
      isCentral: false,
      isDepo: true,
      isRep: false,
      isAdmin: false,
      badgeLabel: 'Caja Oficina',
      badgeBg: '#f0fdfa',
      badgeColor: '#0f766e',
      responsibleName,
      showRouteNote: false,
      activitySummary,
    };
  }

  if (isRep) {
    return {
      kind: 'REPARTIDOR',
      isCentral: false,
      isDepo: false,
      isRep: true,
      isAdmin: false,
      badgeLabel: 'Reparto',
      badgeBg: '#ecfdf5',
      badgeColor: '#047857',
      responsibleName,
      showRouteNote: Boolean(d?.routeNote && String(d.routeNote).trim()),
      activitySummary,
    };
  }

  if (isAdmin) {
    return {
      kind: 'ADMINISTRACION',
      isCentral: false,
      isDepo: false,
      isRep: false,
      isAdmin: true,
      badgeLabel: 'Mostrador',
      badgeBg: '#eef2ff',
      badgeColor: '#3730a3',
      responsibleName,
      showRouteNote: false,
      activitySummary,
    };
  }

  return {
    kind: 'VENDEDOR',
    isCentral: false,
    isDepo: false,
    isRep: false,
    isAdmin: false,
    badgeLabel: 'Vendedor',
    badgeBg: '#eff6ff',
    badgeColor: '#1d4ed8',
    responsibleName,
    showRouteNote: false,
    activitySummary,
  };
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function formatShortDate(date: Date): string {
  return `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}/${String(date.getFullYear()).slice(-2)}`;
}

function formatDayMonth(date: Date): string {
  return `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}`;
}

function formatTime24(date: Date): string {
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

function isSameCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * Formatea la fecha principal del arqueo y, únicamente para Caja Diaria (Oficina),
 * devuelve el rango de apertura -> cierre cuando ambos horarios difieren.
 */
export function formatDrawerDateSummary(
  d: { openedAt?: string | Date | null; closedAt?: string | Date | null },
  isDepo: boolean,
): DrawerDateSummary {
  const closeDate = d.closedAt ? new Date(d.closedAt) : d.openedAt ? new Date(d.openedAt) : null;
  const openDate = d.openedAt ? new Date(d.openedAt) : null;

  if (!closeDate || Number.isNaN(closeDate.getTime())) {
    return { isoDateTime: '', primaryLabel: '—', rangeLabel: null };
  }

  const primaryLabel = `${formatShortDate(closeDate)} · ${formatTime24(closeDate)}`;
  const isoDateTime = closeDate.toISOString();

  if (!isDepo || !openDate || Number.isNaN(openDate.getTime())) {
    return { isoDateTime, primaryLabel, rangeLabel: null };
  }

  const sameDay = isSameCalendarDay(openDate, closeDate);
  const openTime = formatTime24(openDate);
  const closeTime = formatTime24(closeDate);

  if (sameDay && openTime === closeTime) {
    return { isoDateTime, primaryLabel, rangeLabel: null };
  }

  const rangeLabel = sameDay
    ? `${openTime} → ${closeTime}`
    : `${formatDayMonth(openDate)} ${openTime} → ${formatDayMonth(closeDate)} ${closeTime}`;

  return { isoDateTime, primaryLabel, rangeLabel };
}

export function formatCompactTxDetail(t: any): { short: string; full: string; receiptUrl: string | null } {
  const rawDesc = typeof t.description === 'string' ? t.description.trim() : '';
  const isClientReceipt = t.type === 'INCOME' && Boolean(t.personaId || t.persona?.id);

  if (isClientReceipt) {
    const code = t.receiptNumber || `REC-${String(t.id).padStart(5, '0')}`;
    const receiptUrl = t.verificationCode
      ? `/recibo/${t.id}?v=${encodeURIComponent(t.verificationCode)}`
      : `/recibo/${t.id}`;
    return {
      short: code,
      full: rawDesc ? `${code} · ${rawDesc}` : code,
      receiptUrl,
    };
  }

  if (t.receiptNumber) {
    return {
      short: t.receiptNumber,
      full: rawDesc ? `${t.receiptNumber} · ${rawDesc}` : t.receiptNumber,
      receiptUrl: null,
    };
  }
  if (t.orderId) {
    return {
      short: `Pedido #${t.orderId}`,
      full: rawDesc || `Pedido #${t.orderId}`,
      receiptUrl: null,
    };
  }
  if (!rawDesc) {
    return { short: 'Movimiento interno', full: 'Movimiento interno', receiptUrl: null };
  }

  const compact = rawDesc
    .replace(/^(Cobro|Pago)\s+de\s+/i, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  return { short: compact || rawDesc, full: rawDesc, receiptUrl: null };
}

export function formatPaymentMethodLabel(method: string): string {
  if (method === 'CASH') return 'Efectivo';
  if (method === 'CHECK') return 'Cheque';
  if (method === 'BANK_TRANSFER') return 'Transf.';
  return method;
}
