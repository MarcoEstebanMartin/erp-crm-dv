-- Asegurar existencia de la secuencia unificada de movimientos (Regla 5)
CREATE SEQUENCE IF NOT EXISTS movement_seq START WITH 1 INCREMENT BY 1;

-- CreateEnum: Modalidad de entrega del pedido
DO $$
BEGIN
    CREATE TYPE "DeliveryMethod" AS ENUM ('DELIVERY', 'PICKUP');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AlterTable: Order (modalidad de entrega, orden de parada y sello de entrega)
ALTER TABLE "Order"
  ADD COLUMN IF NOT EXISTS "deliveryMethod" "DeliveryMethod" NOT NULL DEFAULT 'DELIVERY',
  ADD COLUMN IF NOT EXISTS "deliverySequence" INTEGER,
  ADD COLUMN IF NOT EXISTS "deliveredAt" TIMESTAMP(3);

-- AlterTable: DeliveryRoute (nombre del viaje y vínculo opcional a legajo de chofer)
ALTER TABLE "DeliveryRoute"
  ADD COLUMN IF NOT EXISTS "routeName" TEXT,
  ADD COLUMN IF NOT EXISTS "driverEmployeeId" INTEGER;

-- Backfill conservador: ventas directas de mostrador ya entregadas sin hoja de ruta -> PICKUP
UPDATE "Order"
SET "deliveryMethod" = 'PICKUP',
    "deliveredAt" = COALESCE("deliveredAt", "updatedAt")
WHERE "salesChannel" = 'MOSTRADOR'
  AND "status" = 'DELIVERED'
  AND "deliveryRouteId" IS NULL
  AND "invoiceNumber" IS NOT NULL;

-- Backfill conservador: pedidos en hojas de ruta ya completadas -> sello deliveredAt
UPDATE "Order" o
SET "deliveredAt" = COALESCE(o."deliveredAt", o."updatedAt")
FROM "DeliveryRoute" dr
WHERE o."deliveryRouteId" = dr."id"
  AND dr."status" = 'COMPLETED'
  AND o."status" = 'DELIVERED'
  AND o."deliveredAt" IS NULL;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Order_deliveryMethod_deliveryRouteId_status_idx" ON "Order"("deliveryMethod", "deliveryRouteId", "status");
CREATE INDEX IF NOT EXISTS "DeliveryRoute_driverEmployeeId_idx" ON "DeliveryRoute"("driverEmployeeId");
CREATE INDEX IF NOT EXISTS "DeliveryRoute_status_date_idx" ON "DeliveryRoute"("status", "date");

-- AddForeignKey
DO $$
BEGIN
    ALTER TABLE "DeliveryRoute"
      ADD CONSTRAINT "DeliveryRoute_driverEmployeeId_fkey"
      FOREIGN KEY ("driverEmployeeId") REFERENCES "Employee"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
