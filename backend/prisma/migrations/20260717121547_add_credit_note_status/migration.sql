-- CreateEnum
CREATE TYPE "CreditNoteStatus" AS ENUM ('PENDING_APPROVAL', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "CreditNote" ADD COLUMN     "status" "CreditNoteStatus" NOT NULL DEFAULT 'PENDING_APPROVAL';
