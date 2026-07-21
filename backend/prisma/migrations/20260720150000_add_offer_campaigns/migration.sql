-- CreateTable
CREATE TABLE "OfferCampaign" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OfferCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OfferCampaignItem" (
    "id" SERIAL NOT NULL,
    "campaignId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "offerPrice" DECIMAL(12,2) NOT NULL,
    "specialTag" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OfferCampaignItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OfferCampaignItem_campaignId_idx" ON "OfferCampaignItem"("campaignId");

-- CreateIndex
CREATE INDEX "OfferCampaignItem_productId_idx" ON "OfferCampaignItem"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "OfferCampaignItem_campaignId_productId_key" ON "OfferCampaignItem"("campaignId", "productId");

-- AddForeignKey
ALTER TABLE "OfferCampaignItem" ADD CONSTRAINT "OfferCampaignItem_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "OfferCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfferCampaignItem" ADD CONSTRAINT "OfferCampaignItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
