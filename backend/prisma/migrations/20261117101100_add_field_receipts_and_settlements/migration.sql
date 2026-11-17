-- CreateEnum
CREATE TYPE "FieldReceiptStatus" AS ENUM ('ISSUED', 'PENDING_VERIFICATION', 'VERIFIED', 'VOIDED');

-- CreateEnum
CREATE TYPE "PaymentVerificationStatus" AS ENUM ('IN_TRANSIT', 'PENDING_BANK', 'CLEARED', 'REJECTED');

-- CreateEnum
CREATE TYPE "SettlementStatus" AS ENUM ('OPEN', 'SUBMITTED', 'APPROVED', 'DISCREPANCY');

-- CreateEnum
CREATE TYPE "WhatsAppDispatchStatus" AS ENUM ('PENDING', 'SENT', 'DELIVERED', 'FAILED');

-- CreateTable
CREATE TABLE "CollectorSettlement" (
    "id" SERIAL NOT NULL,
    "collectorUserId" INTEGER NOT NULL,
    "deliveryRouteId" INTEGER,
    "status" "SettlementStatus" NOT NULL DEFAULT 'OPEN',
    "expectedCash" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "declaredCash" DECIMAL(12,2),
    "cashDifference" DECIMAL(12,2),
    "expectedChecksCount" INTEGER NOT NULL DEFAULT 0,
    "expectedChecksAmount" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "pendingTransfersAmount" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "approvedByUserId" INTEGER,
    "approvedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CollectorSettlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FieldReceipt" (
    "id" SERIAL NOT NULL,
    "receiptNumber" TEXT,
    "provisionalCode" TEXT NOT NULL,
    "personaId" INTEGER NOT NULL,
    "collectorUserId" INTEGER NOT NULL,
    "deliveryRouteId" INTEGER,
    "billingType" "BillingType" NOT NULL DEFAULT 'INTERNAL',
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "status" "FieldReceiptStatus" NOT NULL DEFAULT 'ISSUED',
    "notes" TEXT,
    "voidReason" TEXT,
    "voidedByUserId" INTEGER,
    "voidedAt" TIMESTAMP(3),
    "gpsLat" DOUBLE PRECISION,
    "gpsLng" DOUBLE PRECISION,
    "capturedAt" TIMESTAMP(3) NOT NULL,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "settlementId" INTEGER,
    "transactionId" INTEGER,
    "whatsappStatus" "WhatsAppDispatchStatus" NOT NULL DEFAULT 'PENDING',
    "whatsappMessageId" TEXT,
    "whatsappError" TEXT,
    "pdfUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FieldReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FieldReceiptPayment" (
    "id" SERIAL NOT NULL,
    "fieldReceiptId" INTEGER NOT NULL,
    "paymentMethod" "PaymentMethod" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "status" "PaymentVerificationStatus" NOT NULL DEFAULT 'IN_TRANSIT',
    "bankAccountId" INTEGER,
    "transferReference" TEXT,
    "proofImageUrl" TEXT,
    "checkBank" TEXT,
    "checkNumber" TEXT,
    "checkIssuerCuit" TEXT,
    "checkDueDate" TIMESTAMP(3),
    "checkFrontImageUrl" TEXT,
    "checkBackImageUrl" TEXT,
    "isEcheq" BOOLEAN NOT NULL DEFAULT false,
    "rejectionReason" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FieldReceiptPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CollectorSettlement_collectorUserId_status_idx" ON "CollectorSettlement"("collectorUserId", "status");

-- CreateIndex
CREATE INDEX "CollectorSettlement_deliveryRouteId_idx" ON "CollectorSettlement"("deliveryRouteId");

-- CreateIndex
CREATE INDEX "CollectorSettlement_createdAt_idx" ON "CollectorSettlement"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "FieldReceipt_receiptNumber_key" ON "FieldReceipt"("receiptNumber");

-- CreateIndex
CREATE UNIQUE INDEX "FieldReceipt_provisionalCode_key" ON "FieldReceipt"("provisionalCode");

-- CreateIndex
CREATE UNIQUE INDEX "FieldReceipt_transactionId_key" ON "FieldReceipt"("transactionId");

-- CreateIndex
CREATE INDEX "FieldReceipt_personaId_capturedAt_idx" ON "FieldReceipt"("personaId", "capturedAt");

-- CreateIndex
CREATE INDEX "FieldReceipt_collectorUserId_status_idx" ON "FieldReceipt"("collectorUserId", "status");

-- CreateIndex
CREATE INDEX "FieldReceipt_settlementId_idx" ON "FieldReceipt"("settlementId");

-- CreateIndex
CREATE INDEX "FieldReceipt_whatsappStatus_idx" ON "FieldReceipt"("whatsappStatus");

-- CreateIndex
CREATE INDEX "FieldReceiptPayment_fieldReceiptId_idx" ON "FieldReceiptPayment"("fieldReceiptId");

-- CreateIndex
CREATE INDEX "FieldReceiptPayment_paymentMethod_status_idx" ON "FieldReceiptPayment"("paymentMethod", "status");

-- CreateIndex
CREATE INDEX "FieldReceiptPayment_bankAccountId_idx" ON "FieldReceiptPayment"("bankAccountId");

-- AddForeignKey
ALTER TABLE "CollectorSettlement" ADD CONSTRAINT "CollectorSettlement_collectorUserId_fkey" FOREIGN KEY ("collectorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectorSettlement" ADD CONSTRAINT "CollectorSettlement_deliveryRouteId_fkey" FOREIGN KEY ("deliveryRouteId") REFERENCES "DeliveryRoute"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectorSettlement" ADD CONSTRAINT "CollectorSettlement_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FieldReceipt" ADD CONSTRAINT "FieldReceipt_personaId_fkey" FOREIGN KEY ("personaId") REFERENCES "Persona"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FieldReceipt" ADD CONSTRAINT "FieldReceipt_collectorUserId_fkey" FOREIGN KEY ("collectorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FieldReceipt" ADD CONSTRAINT "FieldReceipt_deliveryRouteId_fkey" FOREIGN KEY ("deliveryRouteId") REFERENCES "DeliveryRoute"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FieldReceipt" ADD CONSTRAINT "FieldReceipt_voidedByUserId_fkey" FOREIGN KEY ("voidedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FieldReceipt" ADD CONSTRAINT "FieldReceipt_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "CollectorSettlement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FieldReceipt" ADD CONSTRAINT "FieldReceipt_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FieldReceiptPayment" ADD CONSTRAINT "FieldReceiptPayment_fieldReceiptId_fkey" FOREIGN KEY ("fieldReceiptId") REFERENCES "FieldReceipt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FieldReceiptPayment" ADD CONSTRAINT "FieldReceiptPayment_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "BankAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
