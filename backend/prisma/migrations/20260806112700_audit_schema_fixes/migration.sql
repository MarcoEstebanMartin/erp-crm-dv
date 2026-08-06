-- DropForeignKey
ALTER TABLE "SaleRouteVisit" DROP CONSTRAINT IF EXISTS "SaleRouteVisit_sellerId_fkey";

-- DropForeignKey
ALTER TABLE "SaleRouteVisit" DROP CONSTRAINT IF EXISTS "SaleRouteVisit_personaId_fkey";

-- DropForeignKey
ALTER TABLE "SalaryAdvance" DROP CONSTRAINT IF EXISTS "SalaryAdvance_employeeId_fkey";

-- DropForeignKey
ALTER TABLE "Payroll" DROP CONSTRAINT IF EXISTS "Payroll_employeeId_fkey";

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Persona_cuit_idx" ON "Persona"("cuit");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Persona_name_idx" ON "Persona"("name");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Order_invoiceNumber_idx" ON "Order"("invoiceNumber");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Order_personaId_createdAt_idx" ON "Order"("personaId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Order_billingType_invoiceType_invoiceNumber_key" ON "Order"("billingType", "invoiceType", "invoiceNumber");

-- AddForeignKey
ALTER TABLE "SaleRouteVisit" ADD CONSTRAINT "SaleRouteVisit_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleRouteVisit" ADD CONSTRAINT "SaleRouteVisit_personaId_fkey" FOREIGN KEY ("personaId") REFERENCES "Persona"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalaryAdvance" ADD CONSTRAINT "SalaryAdvance_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payroll" ADD CONSTRAINT "Payroll_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
