-- Asegurar existencia de la secuencia unificada de movimientos
CREATE SEQUENCE IF NOT EXISTS movement_seq START WITH 1 INCREMENT BY 1;

-- AlterTable StockMovement: incorporar claves foráneas formales y movementId unificado
ALTER TABLE "StockMovement" 
  ADD COLUMN IF NOT EXISTS "creditNoteId" INTEGER,
  ADD COLUMN IF NOT EXISTS "movementId" INTEGER NOT NULL DEFAULT nextval('movement_seq'),
  ADD COLUMN IF NOT EXISTS "orderId" INTEGER,
  ADD COLUMN IF NOT EXISTS "purchaseOrderId" INTEGER;

-- Índices para optimizar consultas de inventario y trazabilidad
CREATE INDEX IF NOT EXISTS "StockMovement_orderId_idx" ON "StockMovement"("orderId");
CREATE INDEX IF NOT EXISTS "StockMovement_purchaseOrderId_idx" ON "StockMovement"("purchaseOrderId");
CREATE INDEX IF NOT EXISTS "StockMovement_creditNoteId_idx" ON "StockMovement"("creditNoteId");
CREATE INDEX IF NOT EXISTS "StockMovement_movementId_idx" ON "StockMovement"("movementId");

-- Claves foráneas (Foreign Keys) con onDelete SET NULL
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'StockMovement_orderId_fkey'
  ) THEN
    ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_orderId_fkey" 
      FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'StockMovement_purchaseOrderId_fkey'
  ) THEN
    ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_purchaseOrderId_fkey" 
      FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'StockMovement_creditNoteId_fkey'
  ) THEN
    ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_creditNoteId_fkey" 
      FOREIGN KEY ("creditNoteId") REFERENCES "CreditNote"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Backfill seguro: vincular registros históricos existentes parseando referenceId
UPDATE "StockMovement" 
SET "orderId" = CAST(SPLIT_PART("referenceId", '-', 2) AS INTEGER) 
WHERE "referenceId" LIKE 'ORDER-%' 
  AND "orderId" IS NULL 
  AND SPLIT_PART("referenceId", '-', 2) ~ '^[0-9]+$' 
  AND EXISTS (SELECT 1 FROM "Order" WHERE "Order"."id" = CAST(SPLIT_PART("StockMovement"."referenceId", '-', 2) AS INTEGER));

UPDATE "StockMovement" 
SET "orderId" = CAST(SPLIT_PART("referenceId", '-', 2) AS INTEGER) 
WHERE "referenceId" LIKE 'CANCEL-%' 
  AND "orderId" IS NULL 
  AND SPLIT_PART("referenceId", '-', 2) ~ '^[0-9]+$' 
  AND EXISTS (SELECT 1 FROM "Order" WHERE "Order"."id" = CAST(SPLIT_PART("StockMovement"."referenceId", '-', 2) AS INTEGER));

UPDATE "StockMovement" 
SET "orderId" = CAST(SPLIT_PART("referenceId", '-', 3) AS INTEGER) 
WHERE "referenceId" LIKE 'ADJUST-ARMADO-%' 
  AND "orderId" IS NULL 
  AND SPLIT_PART("referenceId", '-', 3) ~ '^[0-9]+$' 
  AND EXISTS (SELECT 1 FROM "Order" WHERE "Order"."id" = CAST(SPLIT_PART("StockMovement"."referenceId", '-', 3) AS INTEGER));

