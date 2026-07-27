-- CreateEnum
CREATE TYPE "ClipCandidateBatchStatus" AS ENUM ('PENDING', 'PROCESSING', 'READY', 'FAILED');

-- CreateTable
CREATE TABLE "clip_candidate_batches" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "sourceAssetId" TEXT NOT NULL,
    "targetCount" INTEGER NOT NULL,
    "status" "ClipCandidateBatchStatus" NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clip_candidate_batches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "clip_candidate_batches_sourceAssetId_idx" ON "clip_candidate_batches"("sourceAssetId");

-- AddForeignKey
ALTER TABLE "clip_candidate_batches" ADD CONSTRAINT "clip_candidate_batches_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clip_candidate_batches" ADD CONSTRAINT "clip_candidate_batches_sourceAssetId_fkey" FOREIGN KEY ("sourceAssetId") REFERENCES "source_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
