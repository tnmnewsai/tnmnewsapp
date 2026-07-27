-- CreateEnum
CREATE TYPE "ContentApprovalStatus" AS ENUM ('NOT_APPLICABLE', 'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'REVISION_REQUESTED');

-- CreateEnum
CREATE TYPE "ModerationStatus" AS ENUM ('PENDING', 'CLEAR', 'FLAGGED', 'FAILED');

-- CreateEnum
CREATE TYPE "ThumbnailAssetStatus" AS ENUM ('PENDING', 'RENDERING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "ReviewTargetType" AS ENUM ('RENDERED_CLIP_ASSET');

-- AlterTable
ALTER TABLE "rendered_clip_assets" ADD COLUMN     "contentApprovalStatus" "ContentApprovalStatus" NOT NULL DEFAULT 'NOT_APPLICABLE',
ADD COLUMN     "contentApprovedAt" TIMESTAMP(3),
ADD COLUMN     "contentApprovedByUserId" TEXT,
ADD COLUMN     "moderationDetails" JSONB,
ADD COLUMN     "moderationStatus" "ModerationStatus" NOT NULL DEFAULT 'PENDING';

-- CreateTable
CREATE TABLE "thumbnail_assets" (
    "id" TEXT NOT NULL,
    "clipId" TEXT NOT NULL,
    "sourceRenderedClipAssetId" TEXT,
    "sourceFrameMs" INTEGER,
    "customBaseImageGraphicAssetId" TEXT,
    "titleText" TEXT NOT NULL,
    "descriptionText" TEXT NOT NULL,
    "storageKey" TEXT,
    "status" "ThumbnailAssetStatus" NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "thumbnail_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_comments" (
    "id" TEXT NOT NULL,
    "targetType" "ReviewTargetType" NOT NULL,
    "targetId" TEXT NOT NULL,
    "authorUserId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "review_comments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "thumbnail_assets_clipId_idx" ON "thumbnail_assets"("clipId");

-- CreateIndex
CREATE INDEX "review_comments_targetType_targetId_idx" ON "review_comments"("targetType", "targetId");

-- AddForeignKey
ALTER TABLE "rendered_clip_assets" ADD CONSTRAINT "rendered_clip_assets_contentApprovedByUserId_fkey" FOREIGN KEY ("contentApprovedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "thumbnail_assets" ADD CONSTRAINT "thumbnail_assets_clipId_fkey" FOREIGN KEY ("clipId") REFERENCES "clips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "thumbnail_assets" ADD CONSTRAINT "thumbnail_assets_sourceRenderedClipAssetId_fkey" FOREIGN KEY ("sourceRenderedClipAssetId") REFERENCES "rendered_clip_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "thumbnail_assets" ADD CONSTRAINT "thumbnail_assets_customBaseImageGraphicAssetId_fkey" FOREIGN KEY ("customBaseImageGraphicAssetId") REFERENCES "graphic_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_comments" ADD CONSTRAINT "review_comments_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

