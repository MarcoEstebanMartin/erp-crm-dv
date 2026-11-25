-- Additive migration for Catalog Studio (Folleto & Catálogo PDF)
-- Strictly additive: zero destructive statements, preserves movement_seq and existing tables.

-- AlterTable
ALTER TABLE "Product"
ADD COLUMN IF NOT EXISTS "catalogBadge" TEXT,
ADD COLUMN IF NOT EXISTS "catalogMinQtyLabel" TEXT,
ADD COLUMN IF NOT EXISTS "catalogOldPrice" DECIMAL(12,2),
ADD COLUMN IF NOT EXISTS "catalogShowOldPrice" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "catalogVarieties" TEXT,
ADD COLUMN IF NOT EXISTS "catalogVisible" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE IF NOT EXISTS "CatalogStudioState" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL DEFAULT 'default',
    "title" TEXT NOT NULL DEFAULT 'OFERTAS SEMANALES',
    "subtitle" TEXT,
    "hideOutOfStock" BOOLEAN NOT NULL DEFAULT false,
    "categoryOrder" JSONB,
    "itemOrder" JSONB,
    "combos" JSONB,
    "updatedById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CatalogStudioState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "CatalogStudioState_key_key" ON "CatalogStudioState"("key");

-- Enable RLS to match Supabase security posture
ALTER TABLE "CatalogStudioState" ENABLE ROW LEVEL SECURITY;
