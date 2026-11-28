import { SCALE, divRoundHalfUp, parseScaledBigInt } from '../exactStockMath';
import { resolvePrintClientMeta } from './printFormatters';

export interface ConsolidatedBilledBreakdown {
  orderId: number;
  docLabel: string;
  clientName: string;
  quantityLabel: string;
  weightKgLabel: string | null;
}

export interface ConsolidatedBilledItem {
  productId: string;
  productName: string;
  pickingZone: string;
  location: string;
  isPesable: boolean;
  totalQuantityScaled: bigint;
  totalQuantityLabel: string;
  totalWeightScaled: bigint;
  totalWeightKgLabel: string | null;
  hasEstimatedWeight: boolean;
  orderBreakdown: ConsolidatedBilledBreakdown[];
}

export interface ConsolidatedBilledReport {
  items: ConsolidatedBilledItem[];
  ordersCount: number;
  productsCount: number;
  totalBultos: number;
  totalUnitsLabel: string;
  totalWeightKgLabel: string | null;
}

const ZONE_ORDER: Record<string, number> = {
  FRIO: 0,
  TABLA: 1,
  CAJAS: 2,
};

function formatScaledQuantity(scaled: bigint): string {
  const thousandths = divRoundHalfUp(scaled, 1_000n);
  const abs = thousandths < 0n ? -thousandths : thousandths;
  const sign = thousandths < 0n ? '-' : '';
  const whole = abs / 1_000n;
  const rem = abs % 1_000n;
  if (rem === 0n) return `${sign}${whole}`;
  const trimmedFrac = rem.toString().padStart(3, '0').replace(/0+$/, '');
  return `${sign}${whole},${trimmedFrac}`;
}

function formatScaledKg(scaled: bigint): string {
  const hundredths = divRoundHalfUp(scaled, 10_000n);
  const abs = hundredths < 0n ? -hundredths : hundredths;
  const sign = hundredths < 0n ? '-' : '';
  const whole = abs / 100n;
  const rem = abs % 100n;
  return `${sign}${whole},${rem.toString().padStart(2, '0')}`;
}

function resolveDocLabel(order: any): string {
  const inv = typeof order?.invoiceNumber === 'string' ? order.invoiceNumber.trim() : '';
  if (inv) {
    const parts = inv.split('-');
    if (parts.length === 2) {
      const shortNum = parts[1].replace(/^0+/, '') || '0';
      return `${parts[0]}-${shortNum}`;
    }
    return inv;
  }
  return `#${order?.id ?? ''}`;
}

function resolveShortClientName(fullName: string): string {
  const trimmed = (fullName || '').trim();
  if (!trimmed) return 'Cliente';
  const words = trimmed.split(/\s+/);
  return words.slice(0, 2).join(' ');
}

/**
 * Agrupa pedidos ya facturados por sector, ubicación y producto con aritmética exacta (BigInt)
 * para auditoría de carga al camión y detección rápida de sobrantes/faltantes.
 */
export function buildConsolidatedBilledReport(
  orders: any[],
  zone = 'ALL',
): ConsolidatedBilledReport {
  const validOrders = (orders || []).filter(
    (o) => o && o.status !== 'CANCELLED' && o.status !== 'ANULADO',
  );

  const map = new Map<
    string,
    {
      productId: string;
      productName: string;
      pickingZone: string;
      location: string;
      isPesable: boolean;
      totalQuantityScaled: bigint;
      totalWeightScaled: bigint;
      hasEstimatedWeight: boolean;
      orderBreakdown: ConsolidatedBilledBreakdown[];
    }
  >();

  let totalBultos = 0;
  let totalUnitsScaled = 0n;
  let grandTotalWeightScaled = 0n;
  const matchedOrderIds = new Set<number>();

  for (const order of validOrders) {
    const client = resolvePrintClientMeta(order);
    const docLabel = resolveDocLabel(order);
    const shortClient = resolveShortClientName(client.name);
    let orderMatchedZone = false;

    for (const item of order.items || []) {
      const itemZone = item.product?.pickingZone || item.product?.rubro?.pickingZone || 'CAJAS';
      if (zone !== 'ALL' && itemZone !== zone) continue;

      orderMatchedZone = true;
      const productId = String(item.productId || item.product?.id || item.product?.name || 'unknown');
      const productName = item.product?.name || 'Artículo Desconocido';
      const location = item.product?.defaultLocation || item.location || 'S/U';

      const qtyScaled = parseScaledBigInt(item.quantity ?? 0);
      const actualWeightScaled = parseScaledBigInt(item.weight ?? 0);
      const isPesable = Boolean(item.product?.isPesable || actualWeightScaled > 0n);

      let itemWeightScaled = 0n;
      let isEstimated = false;
      if (isPesable) {
        if (actualWeightScaled > 0n) {
          itemWeightScaled = actualWeightScaled;
        } else {
          const approxScaled = parseScaledBigInt(item.product?.approximateWeight ?? 0);
          if (approxScaled > 0n) {
            itemWeightScaled = divRoundHalfUp(qtyScaled * approxScaled, SCALE);
            isEstimated = true;
          }
        }
      }

      if (!map.has(productId)) {
        map.set(productId, {
          productId,
          productName,
          pickingZone: itemZone,
          location,
          isPesable,
          totalQuantityScaled: 0n,
          totalWeightScaled: 0n,
          hasEstimatedWeight: false,
          orderBreakdown: [],
        });
      }

      const entry = map.get(productId)!;
      entry.totalQuantityScaled += qtyScaled;
      entry.totalWeightScaled += itemWeightScaled;
      if (isPesable) entry.isPesable = true;
      if (isEstimated) entry.hasEstimatedWeight = true;

      totalUnitsScaled += qtyScaled;
      grandTotalWeightScaled += itemWeightScaled;

      entry.orderBreakdown.push({
        orderId: Number(order.id) || 0,
        docLabel,
        clientName: shortClient,
        quantityLabel: formatScaledQuantity(qtyScaled),
        weightKgLabel: itemWeightScaled > 0n ? `${formatScaledKg(itemWeightScaled)} kg` : null,
      });
    }

    if (orderMatchedZone) {
      matchedOrderIds.add(Number(order.id) || 0);
      const bultos = Math.max(0, Math.trunc(Number(order.bultosCount ?? order.bultos ?? 0)));
      totalBultos += bultos;
    }
  }

  const items: ConsolidatedBilledItem[] = Array.from(map.values())
    .sort((a, b) => {
      const zA = ZONE_ORDER[a.pickingZone] ?? 99;
      const zB = ZONE_ORDER[b.pickingZone] ?? 99;
      if (zA !== zB) return zA - zB;
      if (a.pickingZone !== b.pickingZone) return a.pickingZone.localeCompare(b.pickingZone);
      if (a.location !== b.location) return a.location.localeCompare(b.location);
      return a.productName.localeCompare(b.productName);
    })
    .map((entry) => ({
      ...entry,
      totalQuantityLabel: formatScaledQuantity(entry.totalQuantityScaled),
      totalWeightKgLabel:
        entry.totalWeightScaled > 0n ? `${formatScaledKg(entry.totalWeightScaled)} kg` : null,
    }));

  return {
    items,
    ordersCount: matchedOrderIds.size,
    productsCount: items.length,
    totalBultos,
    totalUnitsLabel: formatScaledQuantity(totalUnitsScaled),
    totalWeightKgLabel:
      grandTotalWeightScaled > 0n ? `${formatScaledKg(grandTotalWeightScaled)} kg` : null,
  };
}
