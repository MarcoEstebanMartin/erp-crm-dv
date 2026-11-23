-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "ProviderType" AS ENUM ('MERCADERIA', 'RODADOS', 'SERVICIOS');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AlterTable
ALTER TABLE "Persona" ADD COLUMN IF NOT EXISTS "providerType" "ProviderType" NOT NULL DEFAULT 'MERCADERIA';

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Persona_isProvider_providerType_idx" ON "Persona"("isProvider", "providerType");
