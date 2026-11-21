import prisma from '../../utils/prisma';
import { appCache } from '../../utils/cache';
import { roundToIntegerPeso, toDecimal } from '../../core/money';
import { type WeeklyPromoSpec } from '../../engines/weekly-promos.engine';
import { fetchActiveWeeklyPromosSafe } from '../orders/order-weekly-promos.helper';
import {
  OFFICIAL_STORE_CATEGORIES,
  getStoreCategoryRank,
  normalizeCategoryKey,
  resolveStoreCategory,
} from './store-catalog-taxonomy';

function applyWeeklyPromoCatalogDecoration(params: {
  productId: number;
  isPesable: boolean;
  listBasePrice: number;
  finalPrice: number;
  previousPrice: number | null;
  specialTag: string | null;
  offerName: string | null;
  isOffer: boolean;
  weeklyPromos: WeeklyPromoSpec[];
}) {
  let { finalPrice, previousPrice, specialTag, offerName, isOffer } = params;
  for (const promo of params.weeklyPromos) {
    const item = promo.items.find((i) => i.productId === params.productId);
    if (!item) continue;
    isOffer = true;

    if (promo.type === 'OFFER_PRICE' && item.promoUnitPrice !== null) {
      const promoInt = roundToIntegerPeso(item.promoUnitPrice).toNumber();
      if (item.minQuantity <= 1 && promoInt > 0 && promoInt < finalPrice) {
        if (!previousPrice || finalPrice > promoInt) {
          previousPrice = params.listBasePrice > promoInt ? params.listBasePrice : finalPrice;
        }
        finalPrice = promoInt;
        if (!specialTag) specialTag = 'OFERTA SEMANAL';
        if (!offerName) offerName = promo.name;
      } else if (item.minQuantity > 1) {
        if (!specialTag) specialTag = `DESDE ${item.minQuantity} U. A $${promoInt.toLocaleString('es-AR')}`;
        if (!offerName) offerName = promo.name;
      }
    } else if (promo.type === 'BUY_X_GET_Y' && !params.isPesable) {
      if (!specialTag) specialTag = `PROMO ${item.minQuantity}+${item.freeQuantity} GRATIS`;
      if (!offerName) offerName = promo.name;
    } else if (promo.type === 'COMBO') {
      if (!specialTag) specialTag = 'COMBO SEMANAL';
      if (!offerName) offerName = promo.name;
    }
  }
  return { finalPrice, previousPrice, specialTag, offerName, isOffer };
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

    const [products, rubros, activeCampaigns, activeWeeklyPromos] = await Promise.all([
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
      fetchActiveWeeklyPromosSafe(prisma),
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
      let offerName: string | null = null;

      const activeOfferItem = p.offerCampaignItems.find((i) => i.campaign && i.campaign.isActive);
      let isOffer = Boolean(activeOfferItem);

      if (activeOfferItem) {
        offerName = activeOfferItem.campaign.title;
        const offerVal = roundToIntegerPeso(activeOfferItem.offerPrice).toNumber();
        if (offerVal > 0 && offerVal < listBasePrice) {
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

      const decorated = applyWeeklyPromoCatalogDecoration({
        productId: p.id,
        isPesable: p.isPesable,
        listBasePrice,
        finalPrice,
        previousPrice,
        specialTag,
        offerName,
        isOffer,
        weeklyPromos: activeWeeklyPromos,
      });
      finalPrice = decorated.finalPrice;
      previousPrice = decorated.previousPrice;
      specialTag = decorated.specialTag;
      offerName = decorated.offerName;
      isOffer = decorated.isOffer;

      const storeHighlight =
        p.storeHighlight === 'OFERTON' || p.storeHighlight === 'DESTACADO'
          ? p.storeHighlight
          : null;
      if (storeHighlight === 'OFERTON') {
        isOffer = true;
        if (!specialTag) specialTag = 'OFERTÓN!';
      } else if (storeHighlight === 'DESTACADO') {
        isOffer = true;
        if (!specialTag) specialTag = 'DESTACADO';
      }

      const offerDiscount =
        previousPrice && previousPrice > finalPrice
          ? roundToIntegerPeso(
              toDecimal(previousPrice - finalPrice)
                .dividedBy(previousPrice)
                .times(100),
            ).toNumber()
          : 0;

      const resolvedCategory = resolveStoreCategory({
        campaignGroup: productCampaignGroupMap.get(p.id),
        commercialCategory: p.commercialCategory,
        rubroName: p.rubro?.name,
      });

      const approxWeightNum =
        p.isPesable && p.approximateWeight && Number(p.approximateWeight) > 0
          ? Number(p.approximateWeight)
          : null;
      const estimatedPiecePrice =
        approxWeightNum !== null
          ? roundToIntegerPeso(toDecimal(finalPrice).times(p.approximateWeight!)).toNumber()
          : null;

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
        approximateWeight: approxWeightNum,
        estimatedPiecePrice,
        unitsPerBox: p.unitsPerBox || 1,
        minOrderQuantity: p.minOrderQuantity || 1,
        imageUrl: p.imageUrl,
        rubroId: p.rubroId,
        rubroName: p.rubro?.name || 'General',
        commercialCategoryId: resolvedCategory.id,
        commercialCategoryName: resolvedCategory.name,
        commercialCategoryIcon: resolvedCategory.icon,
        commercialGroupId: resolvedCategory.id,
        commercialGroupName: resolvedCategory.name,
        commercialGroupIcon: resolvedCategory.icon,
        isOffer,
        storeHighlight,
        offerDiscount,
        previousPrice,
        specialTag,
        offerName,
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
      const key = normalizeCategoryKey(p.commercialCategoryName);
      counts.set(key, (counts.get(key) || 0) + 1);
    });

    const configuredNormSet = new Set(
      Array.from(configuredCategoriesSet).map((c) => normalizeCategoryKey(c)),
    );

    const uniqueCategoryMap = new Map<string, { id: string; name: string; icon: string }>();
    const addCat = (rawName: string) => {
      if (!rawName) return;
      const resolved = resolveStoreCategory({ commercialCategory: rawName });
      const normKey = normalizeCategoryKey(resolved.name);
      if ((counts.get(normKey) || 0) > 0 || configuredNormSet.has(normKey)) {
        if (!uniqueCategoryMap.has(normKey)) {
          uniqueCategoryMap.set(normKey, {
            id: resolved.id,
            name: resolved.name,
            icon: resolved.icon,
          });
        }
      }
    };

    campaignCustomOrder.forEach(addCat);
    OFFICIAL_STORE_CATEGORIES.forEach((c) => addCat(c.name));
    configuredCategoriesSet.forEach(addCat);
    formattedProducts.forEach((p) => addCat(p.commercialCategoryName));

    const sortedCategories = Array.from(uniqueCategoryMap.values()).sort(
      (a, b) =>
        getStoreCategoryRank(a.name, campaignCustomOrder) -
        getStoreCategoryRank(b.name, campaignCustomOrder),
    );

    const commercialCategories = [
      { id: 'all', name: 'Todas', icon: '🌟' },
      ...sortedCategories,
    ];

    const responsePayload = {
      status: 'success',
      data: {
        products: formattedProducts,
        commercialCategories,
        commercialGroups: commercialCategories,
        rubros,
        weeklyPromos: activeWeeklyPromos,
      },
    };

    appCache.set(cacheKey, responsePayload, 300);
    return responsePayload;
  }
}
