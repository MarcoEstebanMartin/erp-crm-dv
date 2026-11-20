-- CreateEnum
CREATE TYPE "FuelType" AS ENUM ('NAFTA', 'DIESEL');

-- CreateEnum
CREATE TYPE "FuelLogStatus" AS ENUM ('PENDING', 'SETTLED');

-- AlterTable: Vehicle
ALTER TABLE "Vehicle"
  ADD COLUMN "fuelType" "FuelType",
  ADD COLUMN "trackFuel" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable: FuelLog
ALTER TABLE "FuelLog"
  ADD COLUMN "fuelType" "FuelType" NOT NULL DEFAULT 'DIESEL',
  ADD COLUMN "settledAt" TIMESTAMP(3),
  ADD COLUMN "status" "FuelLogStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "ticketNumber" TEXT,
  ALTER COLUMN "totalCost" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "FuelLog_status_idx" ON "FuelLog"("status");

-- Habilitar Control de Combustible únicamente en los 6 vehículos operativos
UPDATE "Vehicle"
SET "trackFuel" = true, "fuelType" = 'DIESEL'
WHERE "plate" IN ('AB 919 WO', 'AE 178 EC', 'FUL 385');

UPDATE "Vehicle"
SET "trackFuel" = true, "fuelType" = 'NAFTA'
WHERE "plate" IN ('AI 148 CP', 'AE 764 FE', 'AG 422 GS');
