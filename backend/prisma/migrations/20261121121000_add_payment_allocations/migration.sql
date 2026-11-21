-- CreateTable
CREATE TABLE IF NOT EXISTS "PaymentAllocation" (
    "id" SERIAL NOT NULL,
    "transactionId" INTEGER NOT NULL,
    "orderId" INTEGER NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PaymentAllocation_orderId_idx" ON "PaymentAllocation"("orderId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PaymentAllocation_transactionId_idx" ON "PaymentAllocation"("transactionId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "PaymentAllocation_transactionId_orderId_key" ON "PaymentAllocation"("transactionId", "orderId");

-- AddForeignKey
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Enable Row Level Security (Supabase policy parity)
ALTER TABLE "PaymentAllocation" ENABLE ROW LEVEL SECURITY;
