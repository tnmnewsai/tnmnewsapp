-- CreateEnum
CREATE TYPE "SourceAssetType" AS ENUM ('VIDEO_UPLOAD', 'DRIVE_LINK', 'YOUTUBE_LINK', 'BLOG_URL');

-- CreateEnum
CREATE TYPE "SourceAssetStatus" AS ENUM ('PENDING', 'FETCHING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "TranscriptStatus" AS ENUM ('PENDING', 'PROCESSING', 'READY', 'FAILED');

-- CreateTable
CREATE TABLE "source_assets" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "type" "SourceAssetType" NOT NULL,
    "sourceUrl" TEXT,
    "originalFilename" TEXT,
    "storageKey" TEXT,
    "durationMs" INTEGER,
    "status" "SourceAssetStatus" NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "rightsAttestation" BOOLEAN NOT NULL DEFAULT false,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "source_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transcripts" (
    "id" TEXT NOT NULL,
    "sourceAssetId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "language" TEXT,
    "status" "TranscriptStatus" NOT NULL DEFAULT 'PENDING',
    "rawWords" JSONB,
    "correctedWords" JSONB,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transcripts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "source_assets_brandId_idx" ON "source_assets"("brandId");

-- CreateIndex
CREATE UNIQUE INDEX "transcripts_sourceAssetId_key" ON "transcripts"("sourceAssetId");

-- AddForeignKey
ALTER TABLE "source_assets" ADD CONSTRAINT "source_assets_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "source_assets" ADD CONSTRAINT "source_assets_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transcripts" ADD CONSTRAINT "transcripts_sourceAssetId_fkey" FOREIGN KEY ("sourceAssetId") REFERENCES "source_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
