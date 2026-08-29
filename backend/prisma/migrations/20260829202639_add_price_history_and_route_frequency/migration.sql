-- AlterTable Product: Agregar campos de historial y respaldo de precios
ALTER TABLE "Product" 
ADD COLUMN IF NOT EXISTS "previousCostPrice" DECIMAL(12,2),
ADD COLUMN IF NOT EXISTS "previousListPrice" DECIMAL(12,2),
ADD COLUMN IF NOT EXISTS "lastPriceUpdateAt" TIMESTAMP(3);

-- AlterTable SaleRoute: Agregar frecuencia de preventa/reparto (SEMANAL, QUINCENAL_A, QUINCENAL_B)
ALTER TABLE "SaleRoute" 
ADD COLUMN IF NOT EXISTS "frequency" TEXT DEFAULT 'SEMANAL';
