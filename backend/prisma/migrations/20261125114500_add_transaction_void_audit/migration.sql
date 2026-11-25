-- AlterTable: Anulación auditable (soft-void) de recibos de oficina sin borrado físico
ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "voidedAt" TIMESTAMP(3);
ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "voidedById" INTEGER;
ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "voidReason" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Transaction_voidedAt_idx" ON "Transaction"("voidedAt");
CREATE INDEX IF NOT EXISTS "Transaction_voidedById_idx" ON "Transaction"("voidedById");

-- AddForeignKey (idempotente)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Transaction_voidedById_fkey'
  ) THEN
    ALTER TABLE "Transaction"
      ADD CONSTRAINT "Transaction_voidedById_fkey"
      FOREIGN KEY ("voidedById") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
