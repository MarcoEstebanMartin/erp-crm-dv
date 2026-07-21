CREATE SEQUENCE IF NOT EXISTS movement_seq;

-- DropIndex
DROP INDEX IF EXISTS "Persona_cuit_idx";

-- DropIndex
DROP INDEX IF EXISTS "Persona_isActive_idx";

-- DropIndex
DROP INDEX IF EXISTS "Persona_name_idx";

-- DropIndex
DROP INDEX IF EXISTS "User_role_idx";

-- AlterTable
ALTER TABLE "Persona" ADD COLUMN "maxUnpaidInvoices" DECIMAL(5,2) NOT NULL DEFAULT 0.00;
