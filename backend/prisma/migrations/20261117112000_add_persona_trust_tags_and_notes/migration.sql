-- CreateEnum
CREATE TYPE "PersonaNoteCategory" AS ENUM ('GENERAL', 'COBRANZA', 'INCIDENTE', 'COMERCIAL');

-- AlterTable
ALTER TABLE "Persona" ADD COLUMN "trustTags" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "PersonaNote" (
    "id" SERIAL NOT NULL,
    "personaId" INTEGER NOT NULL,
    "authorId" INTEGER NOT NULL,
    "category" "PersonaNoteCategory" NOT NULL DEFAULT 'GENERAL',
    "content" TEXT NOT NULL,
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PersonaNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PersonaNote_personaId_isPinned_createdAt_idx" ON "PersonaNote"("personaId", "isPinned", "createdAt");

-- CreateIndex
CREATE INDEX "PersonaNote_authorId_idx" ON "PersonaNote"("authorId");

-- AddForeignKey
ALTER TABLE "PersonaNote" ADD CONSTRAINT "PersonaNote_personaId_fkey" FOREIGN KEY ("personaId") REFERENCES "Persona"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonaNote" ADD CONSTRAINT "PersonaNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Blindaje Supabase PostgREST (deny-all para anon/authenticated; acceso completo vía Prisma)
ALTER TABLE "public"."PersonaNote" ENABLE ROW LEVEL SECURITY;
