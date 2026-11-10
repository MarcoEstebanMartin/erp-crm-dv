import prisma from '../../utils/prisma';
import { roundToTwoDecimals } from '../../core/money';

export interface ComparisonRow {
  productId: number;
  productName: string;
  sku: string;
  group: string;
  baselinePrice: number | null;
  baselineTag: string | null;
  targetPrice: number | null;
  targetTag: string | null;
  priceDiff: number | null;
  priceDiffPercent: number | null;
  status: 'NEW' | 'REMOVED' | 'INCREASE' | 'DECREASE' | 'UNCHANGED';
}

function resolveItemGroup(item: any): string {
  if (item.campaignGroup) return String(item.campaignGroup).toUpperCase();
  const pName = String(item.product?.name || '').toUpperCase();
  if (pName.includes('MELINCUE')) return 'MELINCUE';
  if (pName.includes('CREMIGAL')) return 'CREMIGAL';
  if (
    pName.includes('BAGGIO') ||
    pName.includes('MOCORETA') ||
    pName.includes('VIDA') ||
    pName.includes('RPB')
  ) {
    return 'R.P.B';
  }
  if (
    pName.includes('FERNET') ||
    pName.includes('BRANCA') ||
    pName.includes('VINO') ||
    pName.includes('BALBO') ||
    pName.includes('BIANCHI') ||
    pName.includes('SERNOVA') ||
    pName.includes('CAZALIS') ||
    pName.includes('CINZANO')
  ) {
    return 'BEBIDAS';
  }
  return 'ALMACEN';
}

export const offerAnalyticsService = {
  async getCampaignSuggestions() {
    const fortyFiveDaysFromNow = new Date();
    fortyFiveDaysFromNow.setDate(fortyFiveDaysFromNow.getDate() + 45);

    const expiringLots = await prisma.productLot.findMany({
      where: {
        stock: { gt: 0 },
        expirationDate: { lte: fortyFiveDaysFromNow },
      },
      include: { product: true },
      orderBy: { expirationDate: 'asc' },
      take: 20,
    });

    const expiringProductsMap = new Map<number, any>();
    expiringLots.forEach((lot) => {
      if (!expiringProductsMap.has(lot.productId) && lot.product.isActive) {
        expiringProductsMap.set(lot.productId, lot.product);
      }
    });
    const expiring = Array.from(expiringProductsMap.values()).slice(0, 10);

    const overstockProducts = await prisma.product.findMany({
      where: { isActive: true, stock: { gt: 50 } },
      orderBy: { stock: 'desc' },
      take: 50,
    });

    const overstock = overstockProducts
      .filter((p) => p.stock > Math.max(20, p.minStock * 2))
      .filter((p) => !expiringProductsMap.has(p.id))
      .slice(0, 10);

    const findByRubro = (keyword: string, take: number) =>
      prisma.product.findMany({
        where: {
          isActive: true,
          rubro: { name: { contains: keyword, mode: 'insensitive' } },
          stock: { gt: 0 },
        },
        orderBy: { stock: 'desc' },
        take,
      });

    const [quesos, fiambres, almacen, frescos] = await Promise.all([
      findByRubro('queso', 8),
      findByRubro('fiambre', 5),
      findByRubro('almacen', 4),
      findByRubro('lacteo', 3),
    ]);

    return {
      expiring,
      overstock,
      structures: { quesos, fiambres, almacen, frescos },
    };
  },

  async getCampaignComparison(params: { baselineId?: string; targetId?: string }) {
    const allCampaigns = await prisma.offerCampaign.findMany({
      orderBy: { createdAt: 'desc' },
      select: { id: true, title: true, createdAt: true },
    });

    const resolvedBaselineId = params.baselineId
      ? Number(params.baselineId)
      : allCampaigns.length > 1
        ? allCampaigns[1].id
        : allCampaigns[0]?.id || null;

    const resolvedTargetId = params.targetId
      ? Number(params.targetId)
      : allCampaigns[0]?.id || null;

    const [baselineCampaign, targetCampaign] = await Promise.all([
      resolvedBaselineId
        ? prisma.offerCampaign.findUnique({
            where: { id: resolvedBaselineId },
            include: { items: { include: { product: true } } },
          })
        : Promise.resolve(null),
      resolvedTargetId
        ? prisma.offerCampaign.findUnique({
            where: { id: resolvedTargetId },
            include: { items: { include: { product: true } } },
          })
        : Promise.resolve(null),
    ]);

    const baselineItems = baselineCampaign?.items || [];
    const targetItems = targetCampaign?.items || [];

    const baselineProductIds = new Set(baselineItems.map((i) => i.productId));
    const targetProductIds = new Set(targetItems.map((i) => i.productId));

    const retained = targetItems.filter((i) => baselineProductIds.has(i.productId));
    const addedByRotation = targetItems.filter((i) => !baselineProductIds.has(i.productId));
    const removedByRotation = baselineItems.filter((i) => !targetProductIds.has(i.productId));
    const stockAlerts = targetItems.filter((i) => (i.product?.stock || 0) <= 0);

    const productMap = new Map<number, ComparisonRow>();

    for (const bItem of baselineItems) {
      const pid = bItem.productId;
      const bPriceDec = roundToTwoDecimals(bItem.offerPrice);
      productMap.set(pid, {
        productId: pid,
        productName: bItem.product?.name || `Producto #${pid}`,
        sku: bItem.product?.sku || '',
        group: resolveItemGroup(bItem),
        baselinePrice: bPriceDec.toNumber(),
        baselineTag: bItem.specialTag || null,
        targetPrice: null,
        targetTag: null,
        priceDiff: null,
        priceDiffPercent: null,
        status: 'REMOVED',
      });
    }

    for (const tItem of targetItems) {
      const pid = tItem.productId;
      const tPriceDec = roundToTwoDecimals(tItem.offerPrice);
      const existing = productMap.get(pid);

      if (existing) {
        existing.targetPrice = tPriceDec.toNumber();
        existing.targetTag = tItem.specialTag || null;
        if (existing.baselinePrice !== null) {
          const bPriceDec = roundToTwoDecimals(existing.baselinePrice);
          const diffDec = roundToTwoDecimals(tPriceDec.minus(bPriceDec));
          existing.priceDiff = diffDec.toNumber();
          existing.priceDiffPercent = bPriceDec.gt(0)
            ? diffDec.dividedBy(bPriceDec).times(100).toDecimalPlaces(1).toNumber()
            : 0;
          if (diffDec.gt('0.01')) existing.status = 'INCREASE';
          else if (diffDec.lt('-0.01')) existing.status = 'DECREASE';
          else existing.status = 'UNCHANGED';
        }
      } else {
        productMap.set(pid, {
          productId: pid,
          productName: tItem.product?.name || `Producto #${pid}`,
          sku: tItem.product?.sku || '',
          group: resolveItemGroup(tItem),
          baselinePrice: null,
          baselineTag: null,
          targetPrice: tPriceDec.toNumber(),
          targetTag: tItem.specialTag || null,
          priceDiff: null,
          priceDiffPercent: null,
          status: 'NEW',
        });
      }
    }

    const comparisonByGroup: Record<string, ComparisonRow[]> = {
      MELINCUE: [],
      CREMIGAL: [],
      'R.P.B': [],
      BEBIDAS: [],
      ALMACEN: [],
      'ARTICULOS POR CANTIDAD': [],
      OTROS: [],
    };

    for (const row of productMap.values()) {
      const gKey = comparisonByGroup[row.group] ? row.group : 'OTROS';
      comparisonByGroup[gKey].push(row);
    }

    Object.keys(comparisonByGroup).forEach((k) => {
      if (comparisonByGroup[k].length === 0) delete comparisonByGroup[k];
    });

    return {
      baselineId: baselineCampaign?.id || null,
      baselineTitle: baselineCampaign?.title || 'Oferta Semana Anterior (15-08)',
      targetId: targetCampaign?.id || null,
      targetTitle: targetCampaign?.title || 'Ofertas Nuevas Esta Semana',
      allCampaigns,
      retainedCount: retained.length,
      addedCount: addedByRotation.length,
      removedCount: removedByRotation.length,
      stockAlertsCount: stockAlerts.length,
      comparisonByGroup,
      details: {
        retained,
        addedByRotation,
        removedByRotation,
        stockAlerts,
      },
    };
  },
};
