-- AlterTable
ALTER TABLE "Order" ADD COLUMN "invoicedAt" TIMESTAMP(3);

-- Backfill historical invoiced orders so existing facturas keep a valid emission timestamp
UPDATE "Order"
SET "invoicedAt" = COALESCE("deliveredAt", "updatedAt", "createdAt")
WHERE "invoiceNumber" IS NOT NULL
  AND "invoicedAt" IS NULL;

-- CreateIndex
CREATE INDEX "Order_invoicedAt_idx" ON "Order"("invoicedAt");
