-- CreateTable
CREATE TABLE "DiscountRule" (
    "id" SERIAL NOT NULL,
    "name" TEXT,
    "personaId" INTEGER,
    "priceList" TEXT,
    "rubroId" INTEGER,
    "productId" INTEGER,
    "billingType" "BillingType",
    "discount" DECIMAL(5,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiscountRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SplitBillingConfig" (
    "id" SERIAL NOT NULL,
    "personaId" INTEGER NOT NULL,
    "rubroId" INTEGER NOT NULL,
    "percentageOfficial" DECIMAL(5,2) NOT NULL DEFAULT 50.00,
    "percentageInternal" DECIMAL(5,2) NOT NULL DEFAULT 50.00,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SplitBillingConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DiscountRule_personaId_idx" ON "DiscountRule"("personaId");

-- CreateIndex
CREATE INDEX "DiscountRule_priceList_idx" ON "DiscountRule"("priceList");

-- CreateIndex
CREATE INDEX "DiscountRule_rubroId_idx" ON "DiscountRule"("rubroId");

-- CreateIndex
CREATE INDEX "DiscountRule_productId_idx" ON "DiscountRule"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "SplitBillingConfig_personaId_rubroId_key" ON "SplitBillingConfig"("personaId", "rubroId");

-- AddForeignKey
ALTER TABLE "DiscountRule" ADD CONSTRAINT "DiscountRule_personaId_fkey" FOREIGN KEY ("personaId") REFERENCES "Persona"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscountRule" ADD CONSTRAINT "DiscountRule_rubroId_fkey" FOREIGN KEY ("rubroId") REFERENCES "Rubro"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscountRule" ADD CONSTRAINT "DiscountRule_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SplitBillingConfig" ADD CONSTRAINT "SplitBillingConfig_personaId_fkey" FOREIGN KEY ("personaId") REFERENCES "Persona"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SplitBillingConfig" ADD CONSTRAINT "SplitBillingConfig_rubroId_fkey" FOREIGN KEY ("rubroId") REFERENCES "Rubro"("id") ON DELETE CASCADE ON UPDATE CASCADE;
