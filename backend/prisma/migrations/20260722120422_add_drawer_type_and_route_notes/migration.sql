-- AlterTable
ALTER TABLE "CashDrawer" ADD COLUMN     "drawerType" TEXT NOT NULL DEFAULT 'DEPOSITO',
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "routeNote" TEXT;
