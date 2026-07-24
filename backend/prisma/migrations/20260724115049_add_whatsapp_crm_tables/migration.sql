-- CreateEnum
CREATE TYPE "CrmMessageDirection" AS ENUM ('INBOUND', 'OUTBOUND');

-- CreateEnum
CREATE TYPE "CrmMessageStatus" AS ENUM ('SENT', 'DELIVERED', 'READ', 'FAILED');

-- CreateEnum
CREATE TYPE "CrmDraftStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- Ensure native sequence exists
CREATE SEQUENCE IF NOT EXISTS movement_seq;



-- CreateTable
CREATE TABLE "CrmConversation" (
    "id" SERIAL NOT NULL,
    "waId" TEXT NOT NULL,
    "contactName" TEXT,
    "personaId" INTEGER,
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unreadCount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrmConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrmMessage" (
    "id" SERIAL NOT NULL,
    "conversationId" INTEGER NOT NULL,
    "direction" "CrmMessageDirection" NOT NULL,
    "body" TEXT NOT NULL,
    "mediaUrl" TEXT,
    "mediaType" TEXT,
    "wamid" TEXT,
    "status" "CrmMessageStatus" NOT NULL DEFAULT 'SENT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CrmMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrmOrderDraft" (
    "id" SERIAL NOT NULL,
    "conversationId" INTEGER NOT NULL,
    "personaId" INTEGER,
    "rawText" TEXT NOT NULL,
    "itemsJson" TEXT NOT NULL,
    "totalEstimated" DECIMAL(12,2) NOT NULL,
    "status" "CrmDraftStatus" NOT NULL DEFAULT 'PENDING',
    "orderId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrmOrderDraft_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CrmConversation_waId_key" ON "CrmConversation"("waId");

-- CreateIndex
CREATE INDEX "CrmConversation_waId_idx" ON "CrmConversation"("waId");

-- CreateIndex
CREATE INDEX "CrmConversation_personaId_idx" ON "CrmConversation"("personaId");

-- CreateIndex
CREATE INDEX "CrmConversation_lastMessageAt_idx" ON "CrmConversation"("lastMessageAt");

-- CreateIndex
CREATE UNIQUE INDEX "CrmMessage_wamid_key" ON "CrmMessage"("wamid");

-- CreateIndex
CREATE INDEX "CrmMessage_conversationId_idx" ON "CrmMessage"("conversationId");

-- CreateIndex
CREATE INDEX "CrmMessage_createdAt_idx" ON "CrmMessage"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CrmOrderDraft_orderId_key" ON "CrmOrderDraft"("orderId");

-- CreateIndex
CREATE INDEX "CrmOrderDraft_conversationId_idx" ON "CrmOrderDraft"("conversationId");

-- CreateIndex
CREATE INDEX "CrmOrderDraft_status_idx" ON "CrmOrderDraft"("status");

-- AddForeignKey
ALTER TABLE "CrmConversation" ADD CONSTRAINT "CrmConversation_personaId_fkey" FOREIGN KEY ("personaId") REFERENCES "Persona"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmMessage" ADD CONSTRAINT "CrmMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "CrmConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmOrderDraft" ADD CONSTRAINT "CrmOrderDraft_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "CrmConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmOrderDraft" ADD CONSTRAINT "CrmOrderDraft_personaId_fkey" FOREIGN KEY ("personaId") REFERENCES "Persona"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmOrderDraft" ADD CONSTRAINT "CrmOrderDraft_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
