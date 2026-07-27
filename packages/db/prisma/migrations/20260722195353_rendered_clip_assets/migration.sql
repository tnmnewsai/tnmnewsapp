-- CreateEnum
CREATE TYPE "RenderedClipAssetStatus" AS ENUM ('PENDING', 'RENDERING', 'READY', 'FAILED');

-- CreateTable
CREATE TABLE "rendered_clip_assets" (
    "id" TEXT NOT NULL,
    "clipId" TEXT NOT NULL,
    "aspectRatio" TEXT NOT NULL,
    "templateVersion" INTEGER,
    "storageKey" TEXT,
    "status" "RenderedClipAssetStatus" NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rendered_clip_assets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "rendered_clip_assets_clipId_idx" ON "rendered_clip_assets"("clipId");

-- AddForeignKey
ALTER TABLE "rendered_clip_assets" ADD CONSTRAINT "rendered_clip_assets_clipId_fkey" FOREIGN KEY ("clipId") REFERENCES "clips"("id") ON DELETE CASCADE ON UPDATE CASCADE;
