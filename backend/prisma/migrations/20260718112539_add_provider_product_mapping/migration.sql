

-- CreateTable
CREATE TABLE "ProviderProductMapping" (
    "id" SERIAL NOT NULL,
    "providerId" INTEGER NOT NULL,
    "providerCode" TEXT NOT NULL,
    "providerName" TEXT,
    "productId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProviderProductMapping_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProviderProductMapping_providerId_idx" ON "ProviderProductMapping"("providerId");

-- CreateIndex
CREATE INDEX "ProviderProductMapping_productId_idx" ON "ProviderProductMapping"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderProductMapping_providerId_providerCode_key" ON "ProviderProductMapping"("providerId", "providerCode");

-- AddForeignKey
ALTER TABLE "ProviderProductMapping" ADD CONSTRAINT "ProviderProductMapping_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Persona"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderProductMapping" ADD CONSTRAINT "ProviderProductMapping_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
