-- CreateTable
CREATE TABLE "brand_templates" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "config" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "brand_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "music_tracks" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "licenseSource" TEXT NOT NULL,
    "licenseType" TEXT NOT NULL,
    "licenseAttribution" TEXT,
    "licenseExpiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "music_tracks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "graphic_assets" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "graphic_assets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "brand_templates_brandId_idx" ON "brand_templates"("brandId");

-- CreateIndex
CREATE UNIQUE INDEX "brand_templates_brandId_version_key" ON "brand_templates"("brandId", "version");

-- CreateIndex
CREATE INDEX "music_tracks_brandId_idx" ON "music_tracks"("brandId");

-- CreateIndex
CREATE INDEX "graphic_assets_brandId_idx" ON "graphic_assets"("brandId");

-- AddForeignKey
ALTER TABLE "brand_templates" ADD CONSTRAINT "brand_templates_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "music_tracks" ADD CONSTRAINT "music_tracks_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "graphic_assets" ADD CONSTRAINT "graphic_assets_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;
