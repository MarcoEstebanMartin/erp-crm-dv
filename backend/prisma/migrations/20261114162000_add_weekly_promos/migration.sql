-- Asegurar existencia de la secuencia unificada de movimientos (Regla 5)
CREATE SEQUENCE IF NOT EXISTS movement_seq START WITH 1 INCREMENT BY 1;

-- CreateEnum: Tipos de Oferta Semanal
CREATE TYPE "WeeklyPromoType" AS ENUM ('OFFER_PRICE', 'BUY_X_GET_Y', 'COMBO');

-- CreateTable: Cabecera de Ofertas Semanales
CREATE TABLE "WeeklyPromo" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "type" "WeeklyPromoType" NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WeeklyPromo_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Productos y Reglas de cada Oferta Semanal
CREATE TABLE "WeeklyPromoItem" (
    "id" SERIAL NOT NULL,
    "promoId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "minQuantity" INTEGER NOT NULL DEFAULT 1,
    "freeQuantity" INTEGER NOT NULL DEFAULT 0,
    "promoUnitPrice" DECIMAL(12,2),

    CONSTRAINT "WeeklyPromoItem_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "WeeklyPromoItem_minQuantity_check" CHECK ("minQuantity" >= 1),
    CONSTRAINT "WeeklyPromoItem_freeQuantity_check" CHECK ("freeQuantity" >= 0),
    CONSTRAINT "WeeklyPromoItem_promoUnitPrice_check" CHECK ("promoUnitPrice" IS NULL OR "promoUnitPrice" >= 0)
);

-- CreateIndex
CREATE INDEX "WeeklyPromo_isActive_startDate_endDate_idx" ON "WeeklyPromo"("isActive", "startDate", "endDate");
CREATE INDEX "WeeklyPromo_createdById_idx" ON "WeeklyPromo"("createdById");
CREATE INDEX "WeeklyPromoItem_promoId_idx" ON "WeeklyPromoItem"("promoId");
CREATE INDEX "WeeklyPromoItem_productId_idx" ON "WeeklyPromoItem"("productId");
CREATE UNIQUE INDEX "WeeklyPromoItem_promoId_productId_key" ON "WeeklyPromoItem"("promoId", "productId");

-- AddForeignKey
ALTER TABLE "WeeklyPromo" ADD CONSTRAINT "WeeklyPromo_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WeeklyPromoItem" ADD CONSTRAINT "WeeklyPromoItem_promoId_fkey" FOREIGN KEY ("promoId") REFERENCES "WeeklyPromo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WeeklyPromoItem" ADD CONSTRAINT "WeeklyPromoItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Blindaje RLS Supabase (PostgREST público bloqueado por defecto, Prisma propietario intacto)
ALTER TABLE "public"."WeeklyPromo" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."WeeklyPromoItem" ENABLE ROW LEVEL SECURITY;
