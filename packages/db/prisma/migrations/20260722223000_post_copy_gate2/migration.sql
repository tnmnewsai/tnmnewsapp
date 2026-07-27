-- CreateEnum
CREATE TYPE "PublishingApprovalStatus" AS ENUM ('NOT_APPLICABLE', 'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'REVISION_REQUESTED');

-- CreateEnum
CREATE TYPE "PostCopyBatchStatus" AS ENUM ('PENDING', 'PROCESSING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "PostCopyStatus" AS ENUM ('DRAFT', 'APPROVED', 'REJECTED');

-- AlterEnum
ALTER TYPE "ReviewTargetType" ADD VALUE 'CLIP';

-- AlterTable
ALTER TABLE "clips" ADD COLUMN     "publishingApprovalStatus" "PublishingApprovalStatus" NOT NULL DEFAULT 'NOT_APPLICABLE',
ADD COLUMN     "publishingApprovedAt" TIMESTAMP(3),
ADD COLUMN     "publishingApprovedByUserId" TEXT,
ADD COLUMN     "selectedPostCopyId" TEXT;

-- CreateTable
CREATE TABLE "post_copy_batches" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "clipId" TEXT NOT NULL,
    "targetCount" INTEGER NOT NULL,
    "status" "PostCopyBatchStatus" NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "post_copy_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "post_copies" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "clipId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "hashtags" JSONB NOT NULL,
    "status" "PostCopyStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "post_copies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "post_copy_batches_clipId_idx" ON "post_copy_batches"("clipId");

-- CreateIndex
CREATE INDEX "post_copies_clipId_idx" ON "post_copies"("clipId");

-- CreateIndex
CREATE INDEX "post_copies_batchId_idx" ON "post_copies"("batchId");

-- CreateIndex
CREATE UNIQUE INDEX "clips_selectedPostCopyId_key" ON "clips"("selectedPostCopyId");

-- AddForeignKey
ALTER TABLE "clips" ADD CONSTRAINT "clips_publishingApprovedByUserId_fkey" FOREIGN KEY ("publishingApprovedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clips" ADD CONSTRAINT "clips_selectedPostCopyId_fkey" FOREIGN KEY ("selectedPostCopyId") REFERENCES "post_copies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_copy_batches" ADD CONSTRAINT "post_copy_batches_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_copy_batches" ADD CONSTRAINT "post_copy_batches_clipId_fkey" FOREIGN KEY ("clipId") REFERENCES "clips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_copies" ADD CONSTRAINT "post_copies_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_copies" ADD CONSTRAINT "post_copies_clipId_fkey" FOREIGN KEY ("clipId") REFERENCES "clips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_copies" ADD CONSTRAINT "post_copies_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "post_copy_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

