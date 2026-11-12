-- Asegurar existencia de la secuencia unificada de movimientos (Regla 5)
CREATE SEQUENCE IF NOT EXISTS movement_seq START WITH 1 INCREMENT BY 1;

-- CreateTable: Plano Configurable de Depósito (Slots WMS)
CREATE TABLE "WarehouseCell" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "depId" TEXT NOT NULL,
    "row" INTEGER NOT NULL,
    "col" INTEGER NOT NULL,
    "isStorage" BOOLEAN NOT NULL DEFAULT true,
    "levels" TEXT NOT NULL DEFAULT 'A',
    "chamber" TEXT NOT NULL DEFAULT 'GENERAL',
    "label" TEXT,
    "fill" TEXT,
    "isBlocked" BOOLEAN NOT NULL DEFAULT false,
    "maxUnits" INTEGER,
    "updatedById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WarehouseCell_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WarehouseCell_code_key" ON "WarehouseCell"("code");
CREATE INDEX "WarehouseCell_depId_idx" ON "WarehouseCell"("depId");
CREATE INDEX "WarehouseCell_isStorage_idx" ON "WarehouseCell"("isStorage");
CREATE INDEX "WarehouseCell_chamber_idx" ON "WarehouseCell"("chamber");
CREATE UNIQUE INDEX "WarehouseCell_depId_row_col_key" ON "WarehouseCell"("depId", "row", "col");

-- Índice compuesto para lecturas veloces de Kardex por Producto y ubicación de Lote
CREATE INDEX IF NOT EXISTS "StockMovement_productId_createdAt_id_idx" ON "StockMovement"("productId", "createdAt" DESC, "id" DESC);
CREATE INDEX IF NOT EXISTS "ProductLot_location_idx" ON "ProductLot"("location");

-- AddForeignKey
ALTER TABLE "WarehouseCell" ADD CONSTRAINT "WarehouseCell_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Blindaje RLS Supabase (PostgREST público bloqueado por defecto, Prisma propietario intacto)
ALTER TABLE "public"."WarehouseCell" ENABLE ROW LEVEL SECURITY;
