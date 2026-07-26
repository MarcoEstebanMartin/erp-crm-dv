-- Ensure PostgreSQL native sequence exists safely
CREATE SEQUENCE IF NOT EXISTS movement_seq START WITH 1 INCREMENT BY 1;

-- CreateIndex
CREATE INDEX "CashDrawer_userId_idx" ON "CashDrawer"("userId");

-- CreateIndex
CREATE INDEX "CashDrawer_status_idx" ON "CashDrawer"("status");

-- CreateIndex
CREATE INDEX "CreditNote_personaId_idx" ON "CreditNote"("personaId");

-- CreateIndex
CREATE INDEX "CreditNote_orderId_idx" ON "CreditNote"("orderId");

-- CreateIndex
CREATE INDEX "CreditNote_userId_idx" ON "CreditNote"("userId");

-- CreateIndex
CREATE INDEX "CreditNote_status_idx" ON "CreditNote"("status");

-- CreateIndex
CREATE INDEX "CreditNoteItem_creditNoteId_idx" ON "CreditNoteItem"("creditNoteId");

-- CreateIndex
CREATE INDEX "CreditNoteItem_productId_idx" ON "CreditNoteItem"("productId");

-- CreateIndex
CREATE INDEX "Order_deliveryRouteId_idx" ON "Order"("deliveryRouteId");

-- CreateIndex
CREATE INDEX "OrderItemLot_orderItemId_idx" ON "OrderItemLot"("orderItemId");

-- CreateIndex
CREATE INDEX "OrderItemLot_productLotId_idx" ON "OrderItemLot"("productLotId");

-- CreateIndex
CREATE INDEX "PurchaseOrder_personaId_idx" ON "PurchaseOrder"("personaId");

-- CreateIndex
CREATE INDEX "PurchaseOrder_status_idx" ON "PurchaseOrder"("status");

-- CreateIndex
CREATE INDEX "PurchaseOrderItem_purchaseOrderId_idx" ON "PurchaseOrderItem"("purchaseOrderId");

-- CreateIndex
CREATE INDEX "PurchaseOrderItem_productId_idx" ON "PurchaseOrderItem"("productId");

-- CreateIndex
CREATE INDEX "SalaryAdvance_payrollId_idx" ON "SalaryAdvance"("payrollId");

-- CreateIndex
CREATE INDEX "SalaryAdvance_cashDrawerId_idx" ON "SalaryAdvance"("cashDrawerId");

-- CreateIndex
CREATE INDEX "SalaryAdvance_bankAccountId_idx" ON "SalaryAdvance"("bankAccountId");

-- CreateIndex
CREATE INDEX "StockMovement_productLotId_idx" ON "StockMovement"("productLotId");

-- CreateIndex
CREATE INDEX "SupplierInvoice_personaId_idx" ON "SupplierInvoice"("personaId");

-- CreateIndex
CREATE INDEX "SupplierInvoice_issueDate_idx" ON "SupplierInvoice"("issueDate");

-- CreateIndex
CREATE INDEX "SupplierInvoice_status_idx" ON "SupplierInvoice"("status");

-- CreateIndex
CREATE INDEX "TaxWithholding_personaId_idx" ON "TaxWithholding"("personaId");

-- CreateIndex
CREATE INDEX "TaxWithholding_taxType_idx" ON "TaxWithholding"("taxType");

-- CreateIndex
CREATE INDEX "TaxWithholding_date_idx" ON "TaxWithholding"("date");

-- CreateIndex
CREATE INDEX "Transaction_supplierInvoiceId_idx" ON "Transaction"("supplierInvoiceId");
