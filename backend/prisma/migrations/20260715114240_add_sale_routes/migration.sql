-- AlterTable
ALTER TABLE "Persona" ADD COLUMN     "routeSequence" INTEGER,
ADD COLUMN     "saleRouteId" INTEGER;

-- CreateTable
CREATE TABLE "SaleRoute" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "sellerId" INTEGER,
    "dayOfWeek" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SaleRoute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaleRouteVisit" (
    "id" SERIAL NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sellerId" INTEGER NOT NULL,
    "personaId" INTEGER NOT NULL,
    "saleRouteId" INTEGER,
    "status" TEXT NOT NULL,
    "noBuyReason" TEXT,
    "notes" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SaleRouteVisit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SaleRoute_sellerId_idx" ON "SaleRoute"("sellerId");

-- CreateIndex
CREATE INDEX "SaleRouteVisit_sellerId_idx" ON "SaleRouteVisit"("sellerId");

-- CreateIndex
CREATE INDEX "SaleRouteVisit_personaId_idx" ON "SaleRouteVisit"("personaId");

-- CreateIndex
CREATE INDEX "SaleRouteVisit_saleRouteId_idx" ON "SaleRouteVisit"("saleRouteId");

-- CreateIndex
CREATE INDEX "SaleRouteVisit_date_idx" ON "SaleRouteVisit"("date");

-- CreateIndex
CREATE INDEX "Persona_saleRouteId_idx" ON "Persona"("saleRouteId");

-- AddForeignKey
ALTER TABLE "Persona" ADD CONSTRAINT "Persona_saleRouteId_fkey" FOREIGN KEY ("saleRouteId") REFERENCES "SaleRoute"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleRoute" ADD CONSTRAINT "SaleRoute_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleRouteVisit" ADD CONSTRAINT "SaleRouteVisit_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleRouteVisit" ADD CONSTRAINT "SaleRouteVisit_personaId_fkey" FOREIGN KEY ("personaId") REFERENCES "Persona"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleRouteVisit" ADD CONSTRAINT "SaleRouteVisit_saleRouteId_fkey" FOREIGN KEY ("saleRouteId") REFERENCES "SaleRoute"("id") ON DELETE SET NULL ON UPDATE CASCADE;
