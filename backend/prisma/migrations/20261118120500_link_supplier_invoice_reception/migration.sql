-- AlterTable
ALTER TABLE "SupplierInvoice" ADD COLUMN     "receptionStatus" TEXT NOT NULL DEFAULT 'NONE',
ADD COLUMN     "receivedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "PurchaseOrder" ADD COLUMN     "receivedAt" TIMESTAMP(3),
ADD COLUMN     "supplierInvoiceId" INTEGER;

-- CreateIndex
CREATE INDEX "SupplierInvoice_receptionStatus_idx" ON "SupplierInvoice"("receptionStatus");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseOrder_supplierInvoiceId_key" ON "PurchaseOrder"("supplierInvoiceId");

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_supplierInvoiceId_fkey" FOREIGN KEY ("supplierInvoiceId") REFERENCES "SupplierInvoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
