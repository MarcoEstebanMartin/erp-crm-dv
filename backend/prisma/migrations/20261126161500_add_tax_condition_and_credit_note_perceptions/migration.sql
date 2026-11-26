-- CreateEnum
CREATE TYPE "TaxCondition" AS ENUM ('RESPONSABLE_INSCRIPTO', 'MONOTRIBUTO', 'EXENTO', 'CONSUMIDOR_FINAL');

-- AlterTable
ALTER TABLE "Persona" ADD COLUMN "taxCondition" "TaxCondition";

-- AlterTable
ALTER TABLE "CreditNote" ADD COLUMN "percepcionAmount" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
ADD COLUMN "percepcionIvaAmount" DECIMAL(12,2) NOT NULL DEFAULT 0.00;
