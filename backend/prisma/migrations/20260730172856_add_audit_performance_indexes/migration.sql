-- CreateIndex
CREATE INDEX IF NOT EXISTS "Order_movementId_idx" ON "Order"("movementId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ProductLot_expirationDate_idx" ON "ProductLot"("expirationDate");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ProductLot_productId_expirationDate_idx" ON "ProductLot"("productId", "expirationDate");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SupplierInvoice_dueDate_idx" ON "SupplierInvoice"("dueDate");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SupplierInvoice_movementId_idx" ON "SupplierInvoice"("movementId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Transaction_movementId_idx" ON "Transaction"("movementId");
