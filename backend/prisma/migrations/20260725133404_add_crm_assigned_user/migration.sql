-- CreateIndex
CREATE INDEX IF NOT EXISTS "CrmConversation_assignedSellerId_idx" ON "CrmConversation"("assignedSellerId");

-- AddForeignKey
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'CrmConversation_assignedSellerId_fkey'
    ) THEN
        ALTER TABLE "CrmConversation" ADD CONSTRAINT "CrmConversation_assignedSellerId_fkey" FOREIGN KEY ("assignedSellerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
