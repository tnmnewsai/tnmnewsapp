-- CreateTable
CREATE TABLE "clips" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "sourceAssetId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "editState" JSONB NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clips_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "clips_brandId_idx" ON "clips"("brandId");

-- CreateIndex
CREATE INDEX "clips_sourceAssetId_idx" ON "clips"("sourceAssetId");

-- AddForeignKey
ALTER TABLE "clips" ADD CONSTRAINT "clips_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clips" ADD CONSTRAINT "clips_sourceAssetId_fkey" FOREIGN KEY ("sourceAssetId") REFERENCES "source_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clips" ADD CONSTRAINT "clips_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
