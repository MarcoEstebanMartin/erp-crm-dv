-- AlterTable DeliveryRoute
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

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RouteGpsPing_deliveryRouteId_idx" ON "RouteGpsPing"("deliveryRouteId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RouteGpsPing_createdAt_idx" ON "RouteGpsPing"("createdAt");

-- AddForeignKey
DO $$ 
BEGIN 
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'RouteGpsPing_deliveryRouteId_fkey'
  ) THEN
    ALTER TABLE "RouteGpsPing" ADD CONSTRAINT "RouteGpsPing_deliveryRouteId_fkey" FOREIGN KEY ("deliveryRouteId") REFERENCES "DeliveryRoute"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
