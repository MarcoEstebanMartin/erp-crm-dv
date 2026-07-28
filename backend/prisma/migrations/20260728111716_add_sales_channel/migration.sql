-- CreateEnum
CREATE TYPE "SalesChannel" AS ENUM ('MOSTRADOR', 'PREVENTA_RUTA', 'TIENDA_WEB', 'TELEFONICO');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN "salesChannel" "SalesChannel" NOT NULL DEFAULT 'MOSTRADOR';

-- CreateIndex
CREATE INDEX "Order_salesChannel_idx" ON "Order"("salesChannel");

