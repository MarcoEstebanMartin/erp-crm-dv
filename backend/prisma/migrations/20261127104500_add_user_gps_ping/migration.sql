-- CreateTable
CREATE TABLE "UserGpsPing" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "accuracy" DOUBLE PRECISION,
    "speed" DOUBLE PRECISION,
    "heading" DOUBLE PRECISION,
    "source" TEXT NOT NULL DEFAULT 'ERP_APP',
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserGpsPing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserGpsPing_userId_recordedAt_idx" ON "UserGpsPing"("userId", "recordedAt");

-- CreateIndex
CREATE INDEX "UserGpsPing_recordedAt_idx" ON "UserGpsPing"("recordedAt");

-- AddForeignKey
ALTER TABLE "UserGpsPing" ADD CONSTRAINT "UserGpsPing_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Enable Row Level Security (Supabase best practice; Prisma connects via service role)
ALTER TABLE "UserGpsPing" ENABLE ROW LEVEL SECURITY;
