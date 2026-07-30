-- AlterTable DeliveryRoute: Add GPS telemetry fields
ALTER TABLE "DeliveryRoute" ADD COLUMN IF NOT EXISTS "currentLat" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "currentLng" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "currentSpeed" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "lastGpsUpdate" TIMESTAMP(3);

-- CreateTable RouteGpsPing
CREATE TABLE IF NOT EXISTS "RouteGpsPing" (
    "id" SERIAL NOT NULL,
    "deliveryRouteId" INTEGER NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "speed" DOUBLE PRECISION,
    "heading" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RouteGpsPing_pkey" PRIMARY KEY ("id")
);

-- CreateIndexes
CREATE INDEX IF NOT EXISTS "RouteGpsPing_deliveryRouteId_idx" ON "RouteGpsPing"("deliveryRouteId");
CREATE INDEX IF NOT EXISTS "RouteGpsPing_createdAt_idx" ON "RouteGpsPing"("createdAt");
CREATE INDEX IF NOT EXISTS "Order_movementId_idx" ON "Order"("movementId");
CREATE INDEX IF NOT EXISTS "ProductLot_expirationDate_idx" ON "ProductLot"("expirationDate");
CREATE INDEX IF NOT EXISTS "ProductLot_productId_expirationDate_idx" ON "ProductLot"("productId", "expirationDate");
CREATE INDEX IF NOT EXISTS "Transaction_movementId_idx" ON "Transaction"("movementId");
CREATE INDEX IF NOT EXISTS "SupplierInvoice_dueDate_idx" ON "SupplierInvoice"("dueDate");
CREATE INDEX IF NOT EXISTS "SupplierInvoice_movementId_idx" ON "SupplierInvoice"("movementId");

-- AddForeignKey
ALTER TABLE "RouteGpsPing" DROP CONSTRAINT IF EXISTS "RouteGpsPing_deliveryRouteId_fkey";
ALTER TABLE "RouteGpsPing" ADD CONSTRAINT "RouteGpsPing_deliveryRouteId_fkey" FOREIGN KEY ("deliveryRouteId") REFERENCES "DeliveryRoute"("id") ON DELETE CASCADE ON UPDATE CASCADE;

