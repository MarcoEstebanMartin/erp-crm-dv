export type WeeklyPromoType = 'OFFER_PRICE' | 'BUY_X_GET_Y' | 'COMBO';

export type PromoVisualStatus = 'VIGENTE' | 'PROGRAMADA' | 'PAUSADA' | 'VENCIDA';

export interface CatalogProduct {
  id: number;
  sku: string;
  name: string;
  listPrice: number | string;
  unitsPerBox?: number | null;
  isPesable?: boolean;
  isActive?: boolean;
}

export interface WeeklyPromoItem {
  id: number;
  promoId: number;
  productId: number;
  minQuantity: number;
  freeQuantity: number;
  promoUnitPrice: number | string | null;
  product?: CatalogProduct;
}

export interface WeeklyPromo {
  id: number;
  name: string;
  type: WeeklyPromoType;
  isActive: boolean;
  startDate: string;
  endDate: string | null;
  createdAt?: string;
  items: WeeklyPromoItem[];
}

export const ALLOWED_WEEKLY_PROMO_USERNAMES = new Set(['admin', 'dario']);

/**
 * Habilita la solapa y gestión de Ofertas Semanales únicamente para
 * admin y Darío (Administración), coincidiendo con el guard del backend.
 */
export function canManageWeeklyPromos(
  user?: { username?: string | null; role?: string | null } | null,
): boolean {
  if (!user) return false;
  const role = String(user.role || '').trim().toUpperCase();
  const username = String(user.username || '').trim().toLowerCase();
  return (role === 'ADMIN' || role === 'FACTURACION') && ALLOWED_WEEKLY_PROMO_USERNAMES.has(username);
}

/** Normaliza texto para búsquedas rápidas sin tildes ni distinción de mayúsculas. */
export function normalizePromoSearch(text: string): string {
  return String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function toLocalYmd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Calcula fechas iniciales sugeridas para una oferta semanal (hoy + 7 días). */
export function getDefaultPromoDates(referenceDate: Date = new Date()): {
  startDate: string;
  endDate: string;
} {
  const start = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate(),
  );
  const end = new Date(start.getTime());
  end.setDate(end.getDate() + 7);
  return {
    startDate: toLocalYmd(start),
    endDate: toLocalYmd(end),
  };
}

/** Resuelve el estado visual de la oferta respecto a su activación y vigencia horaria. */
export function resolvePromoVisualStatus(
  promo: Pick<WeeklyPromo, 'isActive' | 'startDate' | 'endDate'>,
  now: Date = new Date(),
): PromoVisualStatus {
  if (!promo.isActive) return 'PAUSADA';
  const start = new Date(promo.startDate);
  if (!Number.isNaN(start.getTime()) && now.getTime() < start.getTime()) {
    return 'PROGRAMADA';
  }
  if (promo.endDate) {
    const end = new Date(promo.endDate);
    if (!Number.isNaN(end.getTime()) && now.getTime() > end.getTime()) {
      return 'VENCIDA';
    }
  }
  return 'VIGENTE';
}

/** Parsea un valor entero de pesos sin operar con decimales flotantes. */
export function parseIntegerPeso(raw: number | string | null | undefined): number {
  if (raw === null || raw === undefined || raw === '') return 0;
  const str = String(raw).trim();
  const head = str.split('.')[0]?.replace(/[^0-9-]/g, '') || '0';
  const parsed = Number.parseInt(head, 10);
  return Number.isNaN(parsed) ? 0 : parsed;
}

/** Formatea montos en pesos enteros ARS ($1.250). */
export function formatArsInteger(value: number | string | null | undefined): string {
  const intValue = parseIntegerPeso(value);
  return `$${new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(intValue)}`;
}

function formatDayMonth(rawDate: string): string {
  const d = new Date(rawDate);
  if (Number.isNaN(d.getTime())) return '—';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}`;
}

/** Formatea rango compacto de vigencia (ej. 14/11 → 21/11). */
export function formatPromoDateRange(startDate: string, endDate?: string | null): string {
  const startLabel = formatDayMonth(startDate);
  if (!endDate) return `Desde ${startLabel}`;
  return `${startLabel} → ${formatDayMonth(endDate)}`;
}

/** Genera el resumen legible de la condición comercial y beneficio de la oferta. */
export function formatPromoConditionSummary(
  promo: Pick<WeeklyPromo, 'type' | 'items'>,
): string {
  const items = promo.items || [];
  if (items.length === 0) return 'Sin productos configurados';

  if (promo.type === 'OFFER_PRICE') {
    const first = items[0];
    const prodName = first.product?.name || `Producto #${first.productId}`;
    const priceLabel = formatArsInteger(first.promoUnitPrice);
    if ((first.minQuantity || 1) > 1) {
      return `${prodName} · Desde ${first.minQuantity} u. a ${priceLabel} c/u`;
    }
    return `${prodName} · ${priceLabel} c/u`;
  }

  if (promo.type === 'BUY_X_GET_Y') {
    const first = items[0];
    const prodName = first.product?.name || `Producto #${first.productId}`;
    const paid = first.minQuantity || 1;
    const free = first.freeQuantity || 0;
    return `${prodName} · Pagás ${paid} y llevás ${free} sin cargo`;
  }

  const parts = items.map((item) => {
    const prodName = item.product?.name || `Producto #${item.productId}`;
    const qty = item.minQuantity || 1;
    const priceLabel = formatArsInteger(item.promoUnitPrice);
    return `${qty} u. ${prodName} (${priceLabel} c/u)`;
  });
  return parts.join(' + ');
}
