-- CreateEnum
CREATE TYPE "AnalyticsInterval" AS ENUM ('PLUS_1H', 'PLUS_24H', 'PLUS_7D', 'WEEKLY');

-- CreateEnum
CREATE TYPE "AnalyticsSnapshotStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED');

-- CreateTable
CREATE TABLE "analytics_snapshots" (
    "id" TEXT NOT NULL,
    "platformPostResultId" TEXT NOT NULL,
    "interval" "AnalyticsInterval" NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "capturedAt" TIMESTAMP(3),
    "status" "AnalyticsSnapshotStatus" NOT NULL DEFAULT 'PENDING',
    "views" INTEGER,
    "likes" INTEGER,
    "comments" INTEGER,
    "shares" INTEGER,
    "rawMetrics" JSONB,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "analytics_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "analytics_snapshots_platformPostResultId_idx" ON "analytics_snapshots"("platformPostResultId");

-- CreateIndex
CREATE UNIQUE INDEX "analytics_snapshots_platformPostResultId_interval_dueAt_key" ON "analytics_snapshots"("platformPostResultId", "interval", "dueAt");

-- AddForeignKey
ALTER TABLE "analytics_snapshots" ADD CONSTRAINT "analytics_snapshots_platformPostResultId_fkey" FOREIGN KEY ("platformPostResultId") REFERENCES "platform_post_results"("id") ON DELETE CASCADE ON UPDATE CASCADE;

