-- CreateTable
CREATE TABLE "Employee" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "dni" TEXT NOT NULL,
    "cuil" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "position" TEXT NOT NULL,
    "department" TEXT NOT NULL DEFAULT 'OPERACIONES',
    "hireDate" TIMESTAMP(3) NOT NULL,
    "baseSalary" DECIMAL(12,2) NOT NULL,
    "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'BANK_TRANSFER',
    "cbuAlias" TEXT,
    "bankName" TEXT,
    "birthDate" TIMESTAMP(3),
    "emergencyContact" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalaryAdvance" (
    "id" SERIAL NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'CASH',
    "cashDrawerId" INTEGER,
    "bankAccountId" INTEGER,
    "transactionId" INTEGER,
    "payrollId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalaryAdvance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payroll" (
    "id" SERIAL NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "periodMonth" INTEGER NOT NULL,
    "periodYear" INTEGER NOT NULL,
    "baseSalary" DECIMAL(12,2) NOT NULL,
    "commissions" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "overtimeAmount" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "bonuses" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "grossSalary" DECIMAL(12,2) NOT NULL,
    "advancesDeduction" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "otherDeductions" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "netSalary" DECIMAL(12,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "paymentDate" TIMESTAMP(3),
    "paymentMethod" "PaymentMethod",
    "cashDrawerId" INTEGER,
    "bankAccountId" INTEGER,
    "transactionId" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payroll_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeVacation" (
    "id" SERIAL NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'VACATION',
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "daysCount" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'APPROVED',
    "comments" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeVacation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeDocument" (
    "id" SERIAL NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "expirationDate" TIMESTAMP(3) NOT NULL,
    "alertSent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Employee_userId_key" ON "Employee"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_dni_key" ON "Employee"("dni");

-- CreateIndex
CREATE INDEX "Employee_position_idx" ON "Employee"("position");

-- CreateIndex
CREATE INDEX "Employee_department_idx" ON "Employee"("department");

-- CreateIndex
CREATE UNIQUE INDEX "SalaryAdvance_transactionId_key" ON "SalaryAdvance"("transactionId");

-- CreateIndex
CREATE INDEX "SalaryAdvance_employeeId_idx" ON "SalaryAdvance"("employeeId");

-- CreateIndex
CREATE INDEX "SalaryAdvance_status_idx" ON "SalaryAdvance"("status");

-- CreateIndex
CREATE INDEX "SalaryAdvance_date_idx" ON "SalaryAdvance"("date");

-- CreateIndex
CREATE UNIQUE INDEX "Payroll_transactionId_key" ON "Payroll"("transactionId");

-- CreateIndex
CREATE INDEX "Payroll_employeeId_idx" ON "Payroll"("employeeId");

-- CreateIndex
CREATE INDEX "Payroll_status_idx" ON "Payroll"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Payroll_employeeId_periodMonth_periodYear_key" ON "Payroll"("employeeId", "periodMonth", "periodYear");

-- CreateIndex
CREATE INDEX "EmployeeVacation_employeeId_idx" ON "EmployeeVacation"("employeeId");

-- CreateIndex
CREATE INDEX "EmployeeVacation_startDate_endDate_idx" ON "EmployeeVacation"("startDate", "endDate");

-- CreateIndex
CREATE INDEX "EmployeeDocument_employeeId_idx" ON "EmployeeDocument"("employeeId");

-- CreateIndex
CREATE INDEX "EmployeeDocument_expirationDate_idx" ON "EmployeeDocument"("expirationDate");

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalaryAdvance" ADD CONSTRAINT "SalaryAdvance_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalaryAdvance" ADD CONSTRAINT "SalaryAdvance_cashDrawerId_fkey" FOREIGN KEY ("cashDrawerId") REFERENCES "CashDrawer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalaryAdvance" ADD CONSTRAINT "SalaryAdvance_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "BankAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalaryAdvance" ADD CONSTRAINT "SalaryAdvance_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalaryAdvance" ADD CONSTRAINT "SalaryAdvance_payrollId_fkey" FOREIGN KEY ("payrollId") REFERENCES "Payroll"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payroll" ADD CONSTRAINT "Payroll_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payroll" ADD CONSTRAINT "Payroll_cashDrawerId_fkey" FOREIGN KEY ("cashDrawerId") REFERENCES "CashDrawer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payroll" ADD CONSTRAINT "Payroll_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "BankAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payroll" ADD CONSTRAINT "Payroll_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeVacation" ADD CONSTRAINT "EmployeeVacation_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeDocument" ADD CONSTRAINT "EmployeeDocument_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
