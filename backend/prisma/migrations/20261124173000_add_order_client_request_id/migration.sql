-- AlterTable: Idempotencia persistente en PostgreSQL para pedidos y facturas directas
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "clientRequestId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Order_clientRequestId_key" ON "Order"("clientRequestId");
