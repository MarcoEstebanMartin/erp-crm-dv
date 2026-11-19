-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "verificationCode" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_verificationCode_key" ON "Transaction"("verificationCode");
