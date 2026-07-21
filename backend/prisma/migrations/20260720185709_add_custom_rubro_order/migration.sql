-- AlterTable
ALTER TABLE "OfferCampaign" ADD COLUMN "customRubroOrder" TEXT[] DEFAULT ARRAY[]::TEXT[];
