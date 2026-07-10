CREATE SEQUENCE IF NOT EXISTS movement_seq START WITH 1;

-- AlterTable
ALTER TABLE "CreditNote" ADD COLUMN     "movementId" INTEGER NOT NULL DEFAULT nextval('movement_seq');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "movementId" INTEGER NOT NULL DEFAULT nextval('movement_seq');

-- AlterTable
ALTER TABLE "Rubro" ALTER COLUMN "profitMargin" SET DEFAULT 1.25;

-- AlterTable
ALTER TABLE "SupplierInvoice" ADD COLUMN     "movementId" INTEGER NOT NULL DEFAULT nextval('movement_seq');

-- AlterTable
ALTER TABLE "TaxWithholding" ADD COLUMN     "movementId" INTEGER NOT NULL DEFAULT nextval('movement_seq');

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "movementId" INTEGER NOT NULL DEFAULT nextval('movement_seq');
