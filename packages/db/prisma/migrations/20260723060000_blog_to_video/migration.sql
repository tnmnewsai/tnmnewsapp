-- CreateEnum
CREATE TYPE "VideoScriptStatus" AS ENUM ('PENDING', 'PROCESSING', 'READY', 'FAILED');

-- CreateTable
CREATE TABLE "blog_articles" (
    "id" TEXT NOT NULL,
    "sourceAssetId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "bodyText" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "blog_articles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "video_scripts" (
    "id" TEXT NOT NULL,
    "sourceAssetId" TEXT NOT NULL,
    "status" "VideoScriptStatus" NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "video_scripts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "script_segments" (
    "id" TEXT NOT NULL,
    "videoScriptId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "narrationText" TEXT NOT NULL,
    "visualPrompt" TEXT NOT NULL,
    "durationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "script_segments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "blog_articles_sourceAssetId_key" ON "blog_articles"("sourceAssetId");

-- CreateIndex
CREATE UNIQUE INDEX "video_scripts_sourceAssetId_key" ON "video_scripts"("sourceAssetId");

-- CreateIndex
CREATE INDEX "script_segments_videoScriptId_idx" ON "script_segments"("videoScriptId");

-- CreateIndex
CREATE UNIQUE INDEX "script_segments_videoScriptId_order_key" ON "script_segments"("videoScriptId", "order");

-- AddForeignKey
ALTER TABLE "blog_articles" ADD CONSTRAINT "blog_articles_sourceAssetId_fkey" FOREIGN KEY ("sourceAssetId") REFERENCES "source_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_scripts" ADD CONSTRAINT "video_scripts_sourceAssetId_fkey" FOREIGN KEY ("sourceAssetId") REFERENCES "source_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "script_segments" ADD CONSTRAINT "script_segments_videoScriptId_fkey" FOREIGN KEY ("videoScriptId") REFERENCES "video_scripts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

