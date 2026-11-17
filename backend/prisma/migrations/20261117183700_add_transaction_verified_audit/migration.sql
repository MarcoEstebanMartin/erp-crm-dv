-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "verifiedAt" TIMESTAMP(3),
ADD COLUMN     "verifiedById" INTEGER;

-- CreateIndex
CREATE INDEX "Transaction_verifiedById_idx" ON "Transaction"("verifiedById");

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
