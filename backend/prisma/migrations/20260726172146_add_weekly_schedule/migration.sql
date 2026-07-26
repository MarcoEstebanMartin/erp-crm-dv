-- CreateTable
CREATE TABLE IF NOT EXISTS "WeeklySchedule" (
    "id" SERIAL NOT NULL,
    "weekType" TEXT NOT NULL DEFAULT 'SEMANA_1',
    "dayOfWeek" TEXT NOT NULL,
    "activityType" TEXT NOT NULL DEFAULT 'PREVENTA',
    "sellerId" INTEGER,
    "sellerName" TEXT,
    "location" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeeklySchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "SystemSetting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WeeklySchedule_weekType_idx" ON "WeeklySchedule"("weekType");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WeeklySchedule_dayOfWeek_idx" ON "WeeklySchedule"("dayOfWeek");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WeeklySchedule_sellerId_idx" ON "WeeklySchedule"("sellerId");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'WeeklySchedule_sellerId_fkey'
    ) THEN
        ALTER TABLE "WeeklySchedule" ADD CONSTRAINT "WeeklySchedule_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
