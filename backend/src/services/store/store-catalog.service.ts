import prisma from '../../utils/prisma';
import { appCache } from '../../utils/cache';
import { roundToIntegerPeso, toDecimal } from '../../core/money';

const RUBRO_TO_COMMERCIAL_CATEGORY: Record<string, { category: string; icon: string }> = {
  REMOTTI: { category: 'REFRIGERADOS', icon: '❄️' },
  LECHES: { category: 'REFRIGERADOS', icon: '❄️' },
  'SANCOR Y CREMIGAL': { category: 'REFRIGERADOS', icon: '❄️' },
  'QUESOS RALLADOS': { category: 'REFRIGERADOS', icon: '❄️' },
  SODECAR: { category: 'FIAMBRES', icon: '🥓' },
  'A.G.D Y NIZA': { category: 'ADEREZOS Y ACEITES', icon: '🌻' },
  BEBIDAS: { category: 'BEBIDAS', icon: '🥤' },
  'PASTAS SECAS': { category: 'PASTAS SECAS', icon: '🍝' },
  CONSERVAS: { category: 'CONSERVAS', icon: '🥫' },
  PESCADERIA: { category: 'PESCADERÍA', icon: '🐟' },
  PESCADERÍA: { category: 'PESCADERÍA', icon: '🐟' },
  PAPELES: { category: 'PAPELES', icon: '🧻' },
  'NO COMESTIBLES': { category: 'NO COMESTIBLES', icon: '📦' },
  REGALERIA: { category: 'ESTUCHERIA Y REGALERÍA', icon: '🎁' },
  ARROZ: { category: 'PASTAS SECAS', icon: '🌾' },
  CAFE: { category: 'CONSERVAS', icon: '☕' },
  YERBAS: { category: 'PASTAS SECAS', icon: '🧉' },
  AZUCAR: { category: 'PASTAS SECAS', icon: '🍬' },
  EDULCORANTES: { category: 'PASTAS SECAS', icon: '☕' },
};

const CATEGORY_ICONS_MAP: Record<string, string> = {
  REMOTTI: '🧀',
  LECHES: '🥛',
  'SANCOR Y CREMIGAL': '🧈',
  'QUESOS RALLADOS': '🧀',
  SODECAR: '🥓',
  'A.G.D Y NIZA': '🌻',
  BEBIDAS: '🥤',
  'BEBIDAS ALCOHOLICAS': '🍺',
  'BEBIDAS ALCOHÓLICAS': '🍺',
  VINOS: '🍷',
  'ADEREZOS Y ACEITES': '🌻',
  'PASTAS SECAS': '🍝',
  CONSERVAS: '🥫',
  PESCADERÍA: '🐟',
  PESCADERIA: '🐟',
  PAPELES: '🧻',
  'NO COMESTIBLES': '📦',
  REGALERIA: '🎁',
  'ESTUCHERIA Y REGALERÍA': '🎁',
  'ESTUCHERIA Y REGALERIA': '🎁',
  CAFE: '☕',
  ARROZ: '🌾',
  YERBAS: '🧉',
  AZUCAR: '🍬',
  EDULCORANTES: '☕',
  REFRIGERADOS: '❄️',
  FIAMBRES: '🥓',
  VARIOS: '🏷️',
};

const DEFAULT_PRIORITY_ORDER = [
  'REFRIGERADOS',
  'FIAMBRES',
  'ADEREZOS Y ACEITES',
  'CONSERVAS',
  'PESCADERÍA',
  'PASTAS SECAS',
  'BEBIDAS',
  'BEBIDAS ALCOHOLICAS',
  'PAPELES',
  'NO COMESTIBLES',
  'ESTUCHERIA Y REGALERÍA',
  'VARIOS',
];

function normalizeKey(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();
}

export class StoreCatalogService {
  static async buildCatalog(params: { priceList?: string; rubroId?: number; search?: string }) {
    const requestedList = String(params.priceList || 'A').toUpperCase();
    const cacheKey = `store_catalog_${requestedList}_${params.rubroId || 'all'}_${params.search || ''}`;

    const cachedData = appCache.get<any>(cacheKey);
    if (cachedData) return cachedData;

    const whereClause: any = { isActive: true };
    if (params.rubroId) {
      whereClause.rubroId = Number(params.rubroId);
    }
    if (params.search && params.search.trim() !== '') {
      const term = params.search.trim();
      whereClause.OR = [
        { name: { contains: term, mode: 'insensitive' } },
        { sku: { contains: term, mode: 'insensitive' } },
        { barcode: { contains: term, mode: 'insensitive' } },
        { description: { contains: term, mode: 'insensitive' } },
      ];
    }

    const [products, rubros, activeCampaigns] = await Promise.all([
      prisma.product.findMany({
        where: whereClause,
        include: {
          rubro: { select: { id: true, name: true } },
          offerCampaignItems: {
            include: { campaign: { select: { id: true, title: true, isActive: true } } },
          },
        },
        orderBy: { sku: 'asc' },
      }),
      prisma.rubro.findMany({ orderBy: { name: 'asc' } }),
      prisma.offerCampaign.findMany({
        where: { isActive: true },
        include: { items: { select: { productId: true, campaignGroup: true } } },
      }),
    ]);

    const productCampaignGroupMap = new Map<number, string>();
    const configuredCategoriesSet = new Set<string>();
    let campaignCustomOrder: string[] = [];

    activeCampaigns.forEach((camp) => {
      if (Array.isArray(camp.customRubroOrder) && camp.customRubroOrder.length > 0) {
        campaignCustomOrder = camp.customRubroOrder;
        camp.customRubroOrder.forEach((g) => configuredCategoriesSet.add(g));
      }
      camp.items.forEach((item) => {
        if (item.campaignGroup && item.campaignGroup.trim() !== '') {
          const groupName = item.campaignGroup.trim();
          productCampaignGroupMap.set(item.productId, groupName);
          configuredCategoriesSet.add(groupName);
        }
      });
    });

    const formattedProducts = products.map((p) => {
      const priceA = roundToIntegerPeso(p.listPrice).toNumber();
      const priceB = roundToIntegerPeso(p.listPriceB || 0).toNumber();
      const priceC = roundToIntegerPeso(p.listPriceC || 0).toNumber();

      let listBasePrice = priceA;
      if (requestedList.includes('B') && priceB > 0) {
        listBasePrice = priceB;
      } else if (requestedList.includes('C') && priceC > 0) {
        listBasePrice = priceC;
      }

      let finalPrice = listBasePrice;
      let previousPrice: number | null = null;
      let specialTag: string | null = null;

      const activeOfferItem = p.offerCampaignItems.find((i) => i.campaign && i.campaign.isActive);
      const isOffer = Boolean(activeOfferItem);

      if (activeOfferItem) {
        const offerVal = roundToIntegerPeso(activeOfferItem.offerPrice).toNumber();
        if (offerVal > 0) {
          finalPrice = offerVal;
        }
        const prevVal = activeOfferItem.previousPrice
          ? roundToIntegerPeso(activeOfferItem.previousPrice).toNumber()
          : 0;
        if (prevVal > finalPrice) {
          previousPrice = prevVal;
        } else if (listBasePrice > finalPrice) {
          previousPrice = listBasePrice;
        }
        if (activeOfferItem.specialTag && activeOfferItem.specialTag.trim() !== '') {
          specialTag = activeOfferItem.specialTag.trim();
        }
      }

      const offerDiscount =
        previousPrice && previousPrice > finalPrice
          ? roundToIntegerPeso(
              toDecimal(previousPrice - finalPrice)
                .dividedBy(previousPrice)
                .times(100),
            ).toNumber()
          : 0;

      const rubroUpper = (p.rubro?.name || '').toUpperCase().trim();
      const rawCategory =
        productCampaignGroupMap.get(p.id) ||
        p.commercialCategory ||
        RUBRO_TO_COMMERCIAL_CATEGORY[rubroUpper]?.category ||
        p.rubro?.name ||
        'VARIOS';
      const assignedCategory = rawCategory.toUpperCase().trim();
      const catIcon =
        CATEGORY_ICONS_MAP[assignedCategory] ||
        RUBRO_TO_COMMERCIAL_CATEGORY[rubroUpper]?.icon ||
        '📦';
      const slugId = assignedCategory.toLowerCase().replace(/\s+/g, '-');

      return {
        id: p.id,
        sku: p.sku,
        name: p.name,
        description: p.description,
        barcode: p.barcode,
        price: finalPrice,
        listPriceA: priceA,
        listPriceB: priceB,
        listPriceC: priceC,
        stock: p.stock,
        isPesable: p.isPesable,
        unitsPerBox: p.unitsPerBox || 1,
        minOrderQuantity: p.minOrderQuantity || 1,
        imageUrl: p.imageUrl,
        rubroId: p.rubroId,
        rubroName: p.rubro?.name || 'General',
        commercialCategoryId: slugId,
        commercialCategoryName: assignedCategory,
        commercialCategoryIcon: catIcon,
        commercialGroupId: slugId,
        commercialGroupName: assignedCategory,
        commercialGroupIcon: catIcon,
        isOffer,
        offerDiscount,
        previousPrice,
        specialTag,
        offerName: activeOfferItem ? activeOfferItem.campaign.title : null,
      };
    });

    formattedProducts.sort((a, b) =>
      String(a.sku || '').localeCompare(String(b.sku || ''), undefined, {
        numeric: true,
        sensitivity: 'base',
      }),
    );

    const counts = new Map<string, number>();
    formattedProducts.forEach((p) => {
      const key = normalizeKey(p.commercialCategoryName);
      counts.set(key, (counts.get(key) || 0) + 1);
    });

    const uniqueCategoryMap = new Map<string, string>();
    const addCat = (name: string) => {
      if (!name) return;
      const cleanName = name.toUpperCase().trim();
      const normKey = normalizeKey(cleanName);
      if ((counts.get(normKey) || 0) > 0 || configuredCategoriesSet.has(cleanName)) {
        if (!uniqueCategoryMap.has(normKey)) uniqueCategoryMap.set(normKey, cleanName);
      }
    };

    (campaignCustomOrder.length > 0 ? campaignCustomOrder : DEFAULT_PRIORITY_ORDER).forEach(addCat);
    configuredCategoriesSet.forEach(addCat);
    formattedProducts.forEach((p) => addCat(p.commercialCategoryName));

    const getRank = (catName: string) => {
      const norm = normalizeKey(catName);
      const idx = DEFAULT_PRIORITY_ORDER.findIndex((p) => normalizeKey(p) === norm);
      return idx !== -1 ? idx : 999;
    };

    const sortedCategoryNames = Array.from(uniqueCategoryMap.values()).sort(
      (a, b) => getRank(a) - getRank(b),
    );

    const commercialCategories = [
      { id: 'all', name: 'TODOS LOS PRODUCTOS', icon: '📦' },
      ...sortedCategoryNames.map((catName) => ({
        id: catName.toLowerCase().replace(/\s+/g, '-'),
        name: catName,
        icon: CATEGORY_ICONS_MAP[catName] || '📦',
      })),
    ];

    const responsePayload = {
      status: 'success',
      data: {
        products: formattedProducts,
        commercialCategories,
        commercialGroups: commercialCategories,
        rubros,
      },
    };

    appCache.set(cacheKey, responsePayload, 86400);
    return responsePayload;
  }
}
