import { Decimal } from 'decimal.js';
import {
  NumericInput,
  roundToIntegerPeso,
  roundToThreeDecimalsWeight,
  sumIntegerAmounts,
  toDecimal,
} from '../core/money';
import {
  computeMarginPercent,
  findFallbackCostSnapshot,
  normalizeCity,
  ReportLineItemInput,
  resolveItemHistoricalMetrics,
} from './reports-core.engine';

interface ProfitabilityProductRef {
  id: number;
  sku: string;
  name: string;
  costPrice?: NumericInput | null;
  profitMargin?: NumericInput | null;
  isPesable?: boolean | null;
  rubroId?: number | null;
  rubro?: { id: number; name: string; profitMargin?: NumericInput | null } | null;
}

interface ProfitabilityPersonaRef {
  id: number;
  name: string;
  city?: string | null;
  sellerId?: number | null;
  seller?: { username?: string | null } | null;
}

export interface ProfitabilityComputationInput {
  orders: Array<{
    personaId: number;
    sellerId?: number | null;
    billingType: string;
    persona: ProfitabilityPersonaRef;
    items: Array<ReportLineItemInput & { productId: number; product: ProfitabilityProductRef }>;
  }>;
  creditNotes: Array<{
    personaId: number;
    billingType: string;
    totalAmount: NumericInput;
    persona?: ProfitabilityPersonaRef | null;
    order?: {
      sellerId?: number | null;
      items?: Array<{ productId: number; unitCostSnapshot?: NumericInput | null }>;
    } | null;
    items: Array<ReportLineItemInput & { productId: number; product?: ProfitabilityProductRef | null }>;
  }>;
  filters: {
    city?: string;
    sellerId?: number;
    rubroId?: number;
    billingType?: string;
  };
}

export function computeProfitabilityMetrics(input: ProfitabilityComputationInput) {
  const { filters } = input;

  type ClientAcc = {
    id: number;
    businessName: string;
    city: string;
    sellerName: string;
    totalRevenueDec: Decimal;
    totalCostDec: Decimal;
    orderCount: number;
  };
  type ProductAcc = {
    id: number;
    sku: string;
    name: string;
    rubroName: string;
    rubroId: number | null;
    targetMargin: number;
    quantitySoldDec: Decimal;
    totalRevenueDec: Decimal;
    totalCostDec: Decimal;
  };

  const clientMap = new Map<number, ClientAcc>();
  const productMap = new Map<number, ProductAcc>();

  const ensureClient = (
    personaId: number,
    persona: Partial<ProfitabilityPersonaRef> | null | undefined,
    cityLabel: string,
  ): ClientAcc => {
    let acc = clientMap.get(personaId);
    if (!acc) {
      acc = {
        id: personaId,
        businessName: persona?.name || 'Cliente sin nombre',
        city: cityLabel,
        sellerName: persona?.seller?.username || 'Sin Vendedor',
        totalRevenueDec: new Decimal(0),
        totalCostDec: new Decimal(0),
        orderCount: 0,
      };
      clientMap.set(personaId, acc);
    }
    return acc;
  };

  const ensureProduct = (product: ProfitabilityProductRef): ProductAcc => {
    let acc = productMap.get(product.id);
    if (!acc) {
      const prodMargin = Number(product.profitMargin || 0);
      const rubroMargin = product.rubro?.profitMargin
        ? toDecimal(product.rubro.profitMargin).minus(1).times(100).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber()
        : 30;
      acc = {
        id: product.id,
        sku: product.sku,
        name: product.name,
        rubroName: product.rubro?.name || 'Sin Rubro',
        rubroId: product.rubroId ?? null,
        targetMargin: prodMargin > 0 ? prodMargin : rubroMargin,
        quantitySoldDec: new Decimal(0),
        totalRevenueDec: new Decimal(0),
        totalCostDec: new Decimal(0),
      };
      productMap.set(product.id, acc);
    }
    return acc;
  };

  for (const order of input.orders) {
    const personaCity = normalizeCity(order.persona?.city);
    if (filters.city && filters.city !== 'ALL' && personaCity !== filters.city) continue;
    if (filters.sellerId && (order.sellerId ?? order.persona?.sellerId) !== Number(filters.sellerId)) continue;
    if (filters.billingType && filters.billingType !== 'ALL' && order.billingType !== filters.billingType) continue;

    const matchingItems = filters.rubroId
      ? order.items.filter((item) => item.product?.rubroId === Number(filters.rubroId))
      : order.items;
    if (filters.rubroId && matchingItems.length === 0) continue;

    const clientData = ensureClient(order.personaId, order.persona, personaCity);
    clientData.orderCount += 1;

    for (const item of matchingItems) {
      const { qtyDec, itemRevenueDec, itemCostDec } = resolveItemHistoricalMetrics(item);
      clientData.totalRevenueDec = clientData.totalRevenueDec.plus(itemRevenueDec);
      clientData.totalCostDec = clientData.totalCostDec.plus(itemCostDec);

      const prodData = ensureProduct(item.product);
      prodData.quantitySoldDec = prodData.quantitySoldDec.plus(qtyDec);
      prodData.totalRevenueDec = prodData.totalRevenueDec.plus(itemRevenueDec);
      prodData.totalCostDec = prodData.totalCostDec.plus(itemCostDec);
    }
  }

  for (const cn of input.creditNotes) {
    if (filters.billingType && filters.billingType !== 'ALL' && cn.billingType !== filters.billingType) continue;
    const effectiveSellerId = cn.order?.sellerId ?? cn.persona?.sellerId ?? null;
    if (filters.sellerId && effectiveSellerId !== Number(filters.sellerId)) continue;
    const cnCity = normalizeCity(cn.persona?.city);
    if (filters.city && filters.city !== 'ALL' && cnCity !== filters.city) continue;

    if (cn.items && cn.items.length > 0) {
      const matchingItems = filters.rubroId
        ? cn.items.filter((item) => item.product?.rubroId === Number(filters.rubroId))
        : cn.items;
      if (matchingItems.length === 0) continue;

      const clientData = ensureClient(cn.personaId, cn.persona, cnCity);
      for (const item of matchingItems) {
        const fallback = findFallbackCostSnapshot(cn.order?.items, item.productId);
        const { qtyDec, itemRevenueDec, itemCostDec } = resolveItemHistoricalMetrics({
          ...item,
          fallbackUnitCostSnapshot: fallback,
        });
        clientData.totalRevenueDec = clientData.totalRevenueDec.minus(itemRevenueDec);
        clientData.totalCostDec = clientData.totalCostDec.minus(itemCostDec);

        if (item.product) {
          const prodData = ensureProduct(item.product);
          prodData.quantitySoldDec = prodData.quantitySoldDec.minus(qtyDec);
          prodData.totalRevenueDec = prodData.totalRevenueDec.minus(itemRevenueDec);
          prodData.totalCostDec = prodData.totalCostDec.minus(itemCostDec);
        }
      }
    } else if (!filters.rubroId) {
      const clientData = ensureClient(cn.personaId, cn.persona, cnCity);
      clientData.totalRevenueDec = clientData.totalRevenueDec.minus(roundToIntegerPeso(cn.totalAmount || 0));
    }
  }

  const clients = Array.from(clientMap.values())
    .map((c) => {
      const grossProfitDec = c.totalRevenueDec.minus(c.totalCostDec);
      return {
        id: c.id,
        businessName: c.businessName,
        city: c.city,
        sellerName: c.sellerName,
        totalRevenue: roundToIntegerPeso(c.totalRevenueDec).toNumber(),
        totalCost: roundToIntegerPeso(c.totalCostDec).toNumber(),
        orderCount: c.orderCount,
        grossProfit: roundToIntegerPeso(grossProfitDec).toNumber(),
        marginPercent: computeMarginPercent(grossProfitDec, c.totalRevenueDec, 2),
        averageTicket:
          c.orderCount > 0 ? roundToIntegerPeso(c.totalRevenueDec.dividedBy(c.orderCount)).toNumber() : 0,
      };
    })
    .sort((a, b) => b.grossProfit - a.grossProfit);

  const products = Array.from(productMap.values())
    .map((p) => {
      const grossProfitDec = p.totalRevenueDec.minus(p.totalCostDec);
      const grossProfit = roundToIntegerPeso(grossProfitDec).toNumber();
      const marginPercent = computeMarginPercent(grossProfitDec, p.totalRevenueDec, 2);
      const marginGap = toDecimal(marginPercent).minus(p.targetMargin).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();

      let classification: 'STAR' | 'VOLUME' | 'OPPORTUNITY' | 'LOW_MARGIN' = 'OPPORTUNITY';
      if (marginPercent >= 25 && grossProfit > 50000) classification = 'STAR';
      else if (marginPercent < 20 && grossProfit > 50000) classification = 'VOLUME';
      else if (marginPercent < 15) classification = 'LOW_MARGIN';

      return {
        id: p.id,
        sku: p.sku,
        name: p.name,
        rubroName: p.rubroName,
        rubroId: p.rubroId,
        targetMargin: p.targetMargin,
        quantitySold: roundToThreeDecimalsWeight(p.quantitySoldDec).toNumber(),
        totalRevenue: roundToIntegerPeso(p.totalRevenueDec).toNumber(),
        totalCost: roundToIntegerPeso(p.totalCostDec).toNumber(),
        grossProfit,
        marginPercent,
        marginGap,
        classification,
      };
    })
    .sort((a, b) => b.grossProfit - a.grossProfit);

  const totalRevenueDec = sumIntegerAmounts(clients.map((c) => c.totalRevenue));
  const totalCostDec = sumIntegerAmounts(clients.map((c) => c.totalCost));
  const totalGrossProfitDec = totalRevenueDec.minus(totalCostDec);

  const cityMap = new Map<
    string,
    {
      city: string;
      clientCount: number;
      orderCount: number;
      totalRevenueDec: Decimal;
      totalCostDec: Decimal;
    }
  >();

  for (const c of clientMap.values()) {
    let bucket = cityMap.get(c.city);
    if (!bucket) {
      bucket = {
        city: c.city,
        clientCount: 0,
        orderCount: 0,
        totalRevenueDec: new Decimal(0),
        totalCostDec: new Decimal(0),
      };
      cityMap.set(c.city, bucket);
    }
    bucket.clientCount += 1;
    bucket.orderCount += c.orderCount;
    bucket.totalRevenueDec = bucket.totalRevenueDec.plus(c.totalRevenueDec);
    bucket.totalCostDec = bucket.totalCostDec.plus(c.totalCostDec);
  }

  const cities = Array.from(cityMap.values())
    .map((ct) => {
      const grossProfitDec = ct.totalRevenueDec.minus(ct.totalCostDec);
      return {
        city: ct.city,
        clientCount: ct.clientCount,
        orderCount: ct.orderCount,
        totalRevenue: roundToIntegerPeso(ct.totalRevenueDec).toNumber(),
        totalCost: roundToIntegerPeso(ct.totalCostDec).toNumber(),
        grossProfit: roundToIntegerPeso(grossProfitDec).toNumber(),
        marginPercent: computeMarginPercent(grossProfitDec, ct.totalRevenueDec, 2),
        averageTicket:
          ct.orderCount > 0 ? roundToIntegerPeso(ct.totalRevenueDec.dividedBy(ct.orderCount)).toNumber() : 0,
        sharePercent: totalRevenueDec.gt(0)
          ? computeMarginPercent(Decimal.max(0, ct.totalRevenueDec), totalRevenueDec, 2)
          : 0,
      };
    })
    .sort((a, b) => b.grossProfit - a.grossProfit || b.totalRevenue - a.totalRevenue);

  return {
    kpis: {
      totalRevenue: totalRevenueDec.toNumber(),
      totalCost: totalCostDec.toNumber(),
      totalGrossProfit: roundToIntegerPeso(totalGrossProfitDec).toNumber(),
      overallMarginPercent: computeMarginPercent(totalGrossProfitDec, totalRevenueDec, 2),
      topClient: clients.length > 0 ? clients[0] : null,
      topProduct: products.length > 0 ? products[0] : null,
      lowMarginProductsCount: products.filter((p) => p.marginPercent < 15).length,
    },
    clients,
    products,
    cities,
  };
}
