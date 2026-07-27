-- CreateEnum
CREATE TYPE "ClipCandidateStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');

-- AlterTable
ALTER TABLE "clips" ADD COLUMN     "clipCandidateId" TEXT;

-- CreateTable
CREATE TABLE "clip_candidates" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "sourceAssetId" TEXT NOT NULL,
    "startMs" INTEGER NOT NULL,
    "endMs" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "rationale" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "status" "ClipCandidateStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clip_candidates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "clip_candidates_brandId_idx" ON "clip_candidates"("brandId");

-- CreateIndex
CREATE INDEX "clip_candidates_sourceAssetId_idx" ON "clip_candidates"("sourceAssetId");

-- CreateIndex
CREATE UNIQUE INDEX "clips_clipCandidateId_key" ON "clips"("clipCandidateId");

-- AddForeignKey
ALTER TABLE "clip_candidates" ADD CONSTRAINT "clip_candidates_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clip_candidates" ADD CONSTRAINT "clip_candidates_sourceAssetId_fkey" FOREIGN KEY ("sourceAssetId") REFERENCES "source_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clips" ADD CONSTRAINT "clips_clipCandidateId_fkey" FOREIGN KEY ("clipCandidateId") REFERENCES "clip_candidates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

