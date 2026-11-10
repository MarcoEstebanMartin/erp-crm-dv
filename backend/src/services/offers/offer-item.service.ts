import prisma from '../../utils/prisma';
import AppError from '../../utils/AppError';
import { NumericInput, roundToIntegerPeso } from '../../core/money';

export interface CampaignItemInput {
  productId: number | string;
  offerPrice: NumericInput;
  previousPrice?: NumericInput | null;
  specialTag?: string | null;
  showListPrice?: boolean;
  campaignGroup?: string | null;
}

function normalizeCampaignItemPrices(input: CampaignItemInput) {
  const offerPrice = roundToIntegerPeso(input.offerPrice);
  if (offerPrice.lt(0)) {
    throw new AppError('Offer price cannot be negative', 400);
  }

  const hasPrev =
    input.previousPrice !== undefined &&
    input.previousPrice !== null &&
    input.previousPrice !== '';
  const previousPrice = hasPrev ? roundToIntegerPeso(input.previousPrice!).toNumber() : null;

  return {
    productId: Number(input.productId),
    offerPrice: offerPrice.toNumber(),
    previousPrice,
    specialTag: input.specialTag ?? null,
    showListPrice: input.showListPrice !== undefined ? Boolean(input.showListPrice) : false,
    campaignGroup: input.campaignGroup || null,
  };
}

export const offerItemService = {
  async addOrUpdateCampaignItem(campaignId: number, input: CampaignItemInput) {
    if (!Number.isInteger(campaignId) || campaignId <= 0) {
      throw new AppError('Invalid campaign ID', 400);
    }

    const normalized = normalizeCampaignItemPrices(input);
    if (!Number.isInteger(normalized.productId) || normalized.productId <= 0) {
      throw new AppError('Invalid product ID', 400);
    }

    return prisma.offerCampaignItem.upsert({
      where: {
        campaignId_productId: {
          campaignId,
          productId: normalized.productId,
        },
      },
      update: {
        offerPrice: normalized.offerPrice,
        previousPrice: normalized.previousPrice,
        specialTag: normalized.specialTag,
        showListPrice: normalized.showListPrice,
        campaignGroup: normalized.campaignGroup,
      },
      create: {
        campaignId,
        productId: normalized.productId,
        offerPrice: normalized.offerPrice,
        previousPrice: normalized.previousPrice,
        specialTag: normalized.specialTag,
        showListPrice: normalized.showListPrice,
        campaignGroup: normalized.campaignGroup,
      },
      include: {
        product: true,
      },
    });
  },

  async addBulkCampaignItems(campaignId: number, items: CampaignItemInput[]) {
    if (!Number.isInteger(campaignId) || campaignId <= 0) {
      throw new AppError('Invalid campaign ID', 400);
    }
    if (!Array.isArray(items) || items.length === 0) {
      throw new AppError('No items provided', 400);
    }

    const normalizedItems = items.map(normalizeCampaignItemPrices);

    return prisma.$transaction(async (tx) => {
      const results = [];
      for (const item of normalizedItems) {
        const upserted = await tx.offerCampaignItem.upsert({
          where: {
            campaignId_productId: {
              campaignId,
              productId: item.productId,
            },
          },
          update: {
            offerPrice: item.offerPrice,
            previousPrice: item.previousPrice,
            specialTag: item.specialTag,
            showListPrice: item.showListPrice,
            campaignGroup: item.campaignGroup,
          },
          create: {
            campaignId,
            productId: item.productId,
            offerPrice: item.offerPrice,
            previousPrice: item.previousPrice,
            specialTag: item.specialTag,
            showListPrice: item.showListPrice,
            campaignGroup: item.campaignGroup,
          },
        });
        results.push(upserted);
      }
      return results;
    });
  },

  async removeCampaignItem(itemId: number) {
    if (!Number.isInteger(itemId) || itemId <= 0) {
      throw new AppError('Invalid item ID', 400);
    }

    await prisma.offerCampaignItem.delete({
      where: { id: itemId },
    });
  },
};
