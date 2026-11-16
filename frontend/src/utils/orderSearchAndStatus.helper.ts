import { getOrderStatusInfo } from './orderStatusHelper';

export type OrderFilterStatusKey =
  | 'ALL'
  | 'RECIBIDO'
  | 'EN_PICKING'
  | 'ARMADO'
  | 'FACTURADO'
  | 'EN_VIAJE'
  | 'ENTREGADO'
  | 'RETIRO_LOCAL'
  | 'SIN_VIAJE'
  | 'CANCELADO';

export function normalizeSearchText(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Normaliza grafías fonéticas equivalentes en español rioplatense
 * (ej. Yesica/Jessica, Garay/Garai, S/C/Z, B/V, H muda) para evitar búsquedas vacías.
 */
export function toPhoneticKey(value: unknown): string {
  const clean = normalizeSearchText(value).replace(/[^a-z0-9\s]/g, '');
  if (!clean) return '';

  return clean
    .replace(/qu([ei])/g, 'k$1')
    .replace(/c([ei])/g, 's$1')
    .replace(/z/g, 's')
    .replace(/c(?=[aou\s]|$)/g, 'k')
    .replace(/v/g, 'b')
    .replace(/g([ei])/g, 'j$1')
    .replace(/ll/g, 'y')
    .replace(/(?<![aeiou])y(?=$|\s)/g, 'i')
    .replace(/i$/g, 'y')
    .replace(/h/g, '')
    .replace(/(.)\1+/g, '$1');
}

export function matchesSmartSearch(haystack: unknown, rawQuery: string): boolean {
  const normQuery = normalizeSearchText(rawQuery);
  if (!normQuery) return true;

  const normHaystack = normalizeSearchText(haystack);
  if (!normHaystack) return false;
  if (normHaystack.includes(normQuery)) return true;

  const phoneticQuery = toPhoneticKey(normQuery);
  if (phoneticQuery.length < 2) return false;
  const phoneticHaystack = toPhoneticKey(normHaystack);
  return phoneticHaystack.includes(phoneticQuery);
}

export function getWebOrderBadgeCode(order: any): string | null {
  if (order?.bultosDetails && typeof order.bultosDetails === 'object' && order.bultosDetails.webOrderId) {
    return String(order.bultosDetails.webOrderId);
  }
  if (typeof order?.notes === 'string') {
    const m = order.notes.trim().match(/^\[(DV-\d+)\]/i);
    if (m?.[1]) return m[1].toUpperCase();
  }
  return order?.salesChannel === 'TIENDA_WEB' ? 'WEB' : null;
}

export function resolveOrderPersona(order: any): any | null {
  return order?.persona || order?.client || null;
}

export function resolveOrderClientName(order: any, fallback = 'Consumidor Final'): string {
  const persona = resolveOrderPersona(order);
  return persona?.name || order?.clientName || fallback;
}

export function resolveOrderClientCity(order: any): string {
  const persona = resolveOrderPersona(order);
  return persona?.city || '';
}

export function resolveOrderClientRoute(order: any): string {
  const persona = resolveOrderPersona(order);
  return persona?.saleRoute?.name || persona?.route || persona?.city || '';
}

export function resolveOrderBalance(order: any): number {
  const persona = resolveOrderPersona(order);
  return Number(persona?.outstandingBalance ?? 0);
}

const STATUS_LABEL_TO_KEY: Record<string, Exclude<OrderFilterStatusKey, 'ALL'>> = {
  Recibido: 'RECIBIDO',
  'En Picking': 'EN_PICKING',
  Armado: 'ARMADO',
  Facturado: 'FACTURADO',
  'En Viaje': 'EN_VIAJE',
  Entregado: 'ENTREGADO',
  Cancelado: 'CANCELADO',
};

export function getOrderLogicalStatusKey(order: any): Exclude<OrderFilterStatusKey, 'ALL'> {
  const info = getOrderStatusInfo(order);
  return STATUS_LABEL_TO_KEY[info.label] || 'RECIBIDO';
}

export function matchesOrderStatusFilter(order: any, filterKey: string): boolean {
  if (!filterKey || filterKey === 'ALL') return true;
  if (filterKey === 'RETIRO_LOCAL') {
    return order?.status !== 'CANCELLED' && order?.deliveryMethod === 'PICKUP';
  }
  if (filterKey === 'SIN_VIAJE') {
    return (
      order?.status !== 'CANCELLED' &&
      (order?.deliveryMethod || 'DELIVERY') === 'DELIVERY' &&
      !order?.deliveryRouteId &&
      !order?.deliveredAt
    );
  }
  const target = filterKey === 'PENDIENTE' ? 'RECIBIDO' : filterKey;
  return getOrderLogicalStatusKey(order) === target;
}

export function matchesOrderSearch(order: any, rawQuery: string): boolean {
  const trimmed = String(rawQuery || '').trim();
  if (!trimmed) return true;

  const numericClean = normalizeSearchText(trimmed).replace(/^#/, '');
  if (numericClean && String(order?.id ?? '').includes(numericClean)) {
    return true;
  }

  const persona = resolveOrderPersona(order);
  const webCode = getWebOrderBadgeCode(order) || '';
  const candidateFields = [
    persona?.name,
    persona?.cuit,
    persona?.city,
    persona?.route,
    persona?.saleRoute?.name,
    order?.clientName,
    order?.invoiceNumber,
    webCode,
  ];

  return candidateFields.some((field) => field && matchesSmartSearch(field, trimmed));
}

export function isOrderPendingCae(order: any): boolean {
  return (
    order?.billingType === 'OFFICIAL' &&
    Boolean(order?.invoiceNumber) &&
    !order?.cae &&
    order?.status !== 'CANCELLED'
  );
}

export function formatArgentinaDateKey(dateInput: Date | string | number): string {
  const parsed = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (Number.isNaN(parsed.getTime())) return '';
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(parsed);
}

export function shouldShowInFulfillmentBilledColumn(order: any, now: Date = new Date()): boolean {
  if (!order?.invoiceNumber || order?.status === 'CANCELLED') return false;
  if (isOrderPendingCae(order)) return true;

  const targetDate = order.updatedAt || order.createdAt;
  if (!targetDate) return false;
  return formatArgentinaDateKey(targetDate) === formatArgentinaDateKey(now);
}
