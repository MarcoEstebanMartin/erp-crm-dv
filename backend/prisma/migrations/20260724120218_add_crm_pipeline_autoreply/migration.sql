-- Ensure native sequence exists
CREATE SEQUENCE IF NOT EXISTS movement_seq;

-- AlterTable
ALTER TABLE "CrmConversation" ADD COLUMN     "assignedSellerId" INTEGER,
ADD COLUMN     "autoReplyEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "stage" TEXT NOT NULL DEFAULT 'LEAD';



-- CreateIndex
CREATE INDEX "CrmConversation_stage_idx" ON "CrmConversation"("stage");
