-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN     "errorMessage" TEXT,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'SUCCESS';

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");
