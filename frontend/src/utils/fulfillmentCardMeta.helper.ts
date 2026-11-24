import { SCALE, divRoundHalfUp, parseScaledBigInt } from './exactStockMath';
import { getWebOrderBadgeCode, resolveOrderPersona } from './orderSearchAndStatus.helper';

export interface OrderFiscalChannelBadge {
  code: 'A' | 'B' | 'C' | 'X';
  title: string;
  isOfficial: boolean;
}

const AR_SHORT_DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Argentina/Buenos_Aires',
  month: '2-digit',
  day: '2-digit',
});

/**
 * Formatea la antigüedad relativa de un pedido en zona horaria Argentina.
 */
export function formatOrderRelativeAge(
  createdAt: Date | string | number | null | undefined,
  nowMs: number = Date.now(),
): string {
  if (!createdAt) return '';
  const parsed = createdAt instanceof Date ? createdAt : new Date(createdAt);
  const ts = parsed.getTime();
  if (Number.isNaN(ts)) return '';

  const diffMs = Math.max(0, nowMs - ts);
  if (diffMs < 2 * 60_000) return 'recién';
  if (diffMs < 60 * 60_000) {
    return `hace ${Math.floor(diffMs / 60_000)}m`;
  }
  if (diffMs < 24 * 60 * 60_000) {
    return `hace ${Math.floor(diffMs / 3_600_000)}h`;
  }

  const parts = AR_SHORT_DATE_FORMATTER.formatToParts(parsed);
  const map: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== 'literal') map[part.type] = part.value;
  }
  return `${(map.day || '01').padStart(2, '0')}/${(map.month || '01').padStart(2, '0')}`;
}

/**
 * Determina el canal de origen operativo del pedido (Tienda Web, Preventista o Mostrador).
 */
export function resolveOrderOriginLabel(order: any): string {
  const webCode = getWebOrderBadgeCode(order);
  if (webCode) {
    return webCode === 'WEB' ? 'Tienda Web' : `Web · ${webCode}`;
  }
  const sellerName = String(order?.seller?.username || '').trim();
  if (sellerName) {
    return `Prev. · ${sellerName}`;
  }
  return 'Mostrador';
}

/**
 * Resuelve la insignia fiscal compacta del pedido (A, B, C u Interno X).
 */
export function resolveOrderFiscalChannelBadge(order: any): OrderFiscalChannelBadge {
  const invType = String(order?.invoiceType || '').toUpperCase();
  if (invType === 'FACTURA_A') {
    return { code: 'A', title: 'Factura A (Oficial AFIP)', isOfficial: true };
  }
  if (invType === 'FACTURA_B') {
    return { code: 'B', title: 'Factura B (Oficial AFIP)', isOfficial: true };
  }
  if (invType === 'FACTURA_C') {
    return { code: 'C', title: 'Factura C (Oficial AFIP)', isOfficial: true };
  }
  if (order?.billingType === 'OFFICIAL') {
    const persona = resolveOrderPersona(order);
    const digits = String(persona?.cuit || '').replace(/\D/g, '');
    const code = digits.length === 11 ? 'A' : 'B';
    return {
      code,
      title: `Canal Oficial (Factura ${code})`,
      isOfficial: true,
    };
  }
  return { code: 'X', title: 'Comprobante Interno / Remito X', isOfficial: false };
}

/**
 * Redondea un monto a peso entero exacto usando BigInt escalado (ROUND_HALF_UP).
 */
export function toOrderIntegerPesosBigInt(value: string | number | null | undefined): bigint {
  return divRoundHalfUp(parseScaledBigInt(value), SCALE);
}

/**
 * Suma totales de pedidos en pesos enteros exactos sin usar aritmética flotante.
 */
export function sumOrdersTotalInt(orders: any[]): bigint {
  let total = 0n;
  for (const order of orders || []) {
    total += toOrderIntegerPesosBigInt(order?.totalAmount);
  }
  return total;
}

/**
 * Formatea un monto BigInt entero en pesos argentinos ($312.450).
 */
export function formatBigIntARS(amount: bigint): string {
  const sign = amount < 0n ? '-' : '';
  const absStr = (amount < 0n ? -amount : amount).toString();
  const grouped = absStr.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${sign}$${grouped}`;
}

/**
 * Calcula grilla adaptativa para columnas de armado: comprime columnas vacías sin aplastar las activas.
 */
export function computeAdaptiveFulfillmentColumns(
  pendingCount: number,
  preparingCount: number,
  billedCount: number,
): string {
  if (pendingCount === 0 && preparingCount === 0 && billedCount === 0) {
    return 'repeat(3, minmax(260px, 1fr))';
  }
  return [pendingCount, preparingCount, billedCount]
    .map((count) => (count > 0 ? 'minmax(310px, 1.35fr)' : 'minmax(210px, 0.55fr)'))
    .join(' ');
}

export type FulfillmentStageKey = 'PENDING' | 'PREPARING' | 'BILLED';

export interface FulfillmentStageTone {
  dot: string;
  bg: string;
  border: string;
  text: string;
  accent: string;
}

/**
 * Paleta sutil compartida entre Tablero y Lista para identificar cada etapa de armado.
 */
export const FULFILLMENT_STAGE_TONES: Record<FulfillmentStageKey, FulfillmentStageTone> = {
  PENDING: {
    dot: '#D97706',
    bg: '#FFFBEB',
    border: '#FDE68A',
    text: '#92400E',
    accent: '#F59E0B',
  },
  PREPARING: {
    dot: '#2563EB',
    bg: '#EFF6FF',
    border: '#BFDBFE',
    text: '#1E40AF',
    accent: '#3B82F6',
  },
  BILLED: {
    dot: '#059669',
    bg: '#ECFDF5',
    border: '#A7F3D0',
    text: '#065F46',
    accent: '#10B981',
  },
};

/**
 * Devuelve los IDs únicos de pedidos pendientes (PENDING / RECIBIDO) que deben pasar
 * automáticamente a En Picking (PREPARING) al imprimirse la hoja de armado.
 */
export function selectPendingOrderIdsForAutoPicking(
  orders: Array<{ id?: number; status?: string } | null | undefined>,
): number[] {
  const seen = new Set<number>();
  const ids: number[] = [];
  for (const order of orders || []) {
    const id = Number(order?.id);
    if (!Number.isInteger(id) || id <= 0 || seen.has(id)) continue;
    const status = String(order?.status || '').toUpperCase();
    if (status === 'PENDING' || status === 'RECIBIDO') {
      seen.add(id);
      ids.push(id);
    }
  }
  return ids;
}

/**
 * Ejecuta una operación asíncrona sobre una lista con concurrencia acotada
 * para evitar saturar el pool de transacciones de la base de datos en acciones por lote.
 */
export async function runInControlledBatches<T>(
  items: T[],
  worker: (item: T) => Promise<unknown>,
  concurrency = 3,
): Promise<void> {
  if (!items || items.length === 0) return;
  const batchSize = Math.max(1, Math.floor(concurrency));
  for (let i = 0; i < items.length; i += batchSize) {
    const chunk = items.slice(i, i + batchSize);
    await Promise.all(chunk.map((item) => worker(item)));
  }
}
