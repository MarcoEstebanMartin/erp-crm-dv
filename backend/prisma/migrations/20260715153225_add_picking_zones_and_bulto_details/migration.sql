-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "bultosCount" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "bultosDetails" JSONB;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "unitsPerBox" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "Rubro" ADD COLUMN     "pickingZone" TEXT NOT NULL DEFAULT 'CAJAS';
