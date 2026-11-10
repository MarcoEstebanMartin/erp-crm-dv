-- Asegurar existencia de la secuencia unificada de movimientos (Regla 5)
CREATE SEQUENCE IF NOT EXISTS movement_seq START WITH 1 INCREMENT BY 1;

-- CreateEnum
CREATE TYPE "LedgerEntryType" AS ENUM ('DEBIT', 'CREDIT');

-- CreateEnum
CREATE TYPE "LedgerSourceType" AS ENUM (
    'OPENING_BALANCE',
    'ORDER_INVOICE',
    'ORDER_CANCELLATION',
    'COLLECTION_RECEIPT',
    'RECEIPT_REVERSAL',
    'CREDIT_NOTE',
    'SUPPLIER_INVOICE',
    'SUPPLIER_INVOICE_REVERSAL',
    'SUPPLIER_PAYMENT',
    'TAX_WITHHOLDING',
    'RECONCILIATION_ADJUSTMENT'
);

-- CreateTable
CREATE TABLE "AccountLedger" (
    "id" SERIAL NOT NULL,
    "movementId" INTEGER NOT NULL DEFAULT nextval('movement_seq'),
    "personaId" INTEGER NOT NULL,
    "entryType" "LedgerEntryType" NOT NULL,
    "sourceType" "LedgerSourceType" NOT NULL,
    "billingType" "BillingType" NOT NULL DEFAULT 'INTERNAL',
    "amount" DECIMAL(12,2) NOT NULL,
    "balanceAfter" DECIMAL(12,2) NOT NULL,
    "reference" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "metadata" JSONB,
    "orderId" INTEGER,
    "transactionId" INTEGER,
    "creditNoteId" INTEGER,
    "supplierInvoiceId" INTEGER,
    "purchaseOrderId" INTEGER,
    "taxWithholdingId" INTEGER,
    "userId" INTEGER,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountLedger_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AccountLedger_personaId_occurredAt_id_idx" ON "AccountLedger"("personaId", "occurredAt", "id");

-- CreateIndex
CREATE INDEX "AccountLedger_sourceType_idx" ON "AccountLedger"("sourceType");

-- CreateIndex
CREATE INDEX "AccountLedger_billingType_idx" ON "AccountLedger"("billingType");

-- CreateIndex
CREATE INDEX "AccountLedger_orderId_idx" ON "AccountLedger"("orderId");

-- CreateIndex
CREATE INDEX "AccountLedger_transactionId_idx" ON "AccountLedger"("transactionId");

-- CreateIndex
CREATE INDEX "AccountLedger_creditNoteId_idx" ON "AccountLedger"("creditNoteId");

-- CreateIndex
CREATE INDEX "AccountLedger_supplierInvoiceId_idx" ON "AccountLedger"("supplierInvoiceId");

-- CreateIndex
CREATE INDEX "AccountLedger_purchaseOrderId_idx" ON "AccountLedger"("purchaseOrderId");

-- CreateIndex
CREATE INDEX "AccountLedger_taxWithholdingId_idx" ON "AccountLedger"("taxWithholdingId");

-- CreateIndex
CREATE INDEX "AccountLedger_movementId_idx" ON "AccountLedger"("movementId");

-- AddForeignKey
ALTER TABLE "AccountLedger" ADD CONSTRAINT "AccountLedger_personaId_fkey" FOREIGN KEY ("personaId") REFERENCES "Persona"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountLedger" ADD CONSTRAINT "AccountLedger_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountLedger" ADD CONSTRAINT "AccountLedger_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountLedger" ADD CONSTRAINT "AccountLedger_creditNoteId_fkey" FOREIGN KEY ("creditNoteId") REFERENCES "CreditNote"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountLedger" ADD CONSTRAINT "AccountLedger_supplierInvoiceId_fkey" FOREIGN KEY ("supplierInvoiceId") REFERENCES "SupplierInvoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountLedger" ADD CONSTRAINT "AccountLedger_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountLedger" ADD CONSTRAINT "AccountLedger_taxWithholdingId_fkey" FOREIGN KEY ("taxWithholdingId") REFERENCES "TaxWithholding"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountLedger" ADD CONSTRAINT "AccountLedger_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
