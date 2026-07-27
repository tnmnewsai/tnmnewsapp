-- CreateEnum
CREATE TYPE "Platform" AS ENUM ('YOUTUBE', 'META', 'TIKTOK', 'X');

-- CreateEnum
CREATE TYPE "PlatformAccountStatus" AS ENUM ('CONNECTED', 'DISCONNECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ScheduledPostStatus" AS ENUM ('SCHEDULED', 'PUBLISHING', 'PUBLISHED', 'PARTIALLY_PUBLISHED', 'FAILED');

-- CreateEnum
CREATE TYPE "PublishingPackageStatus" AS ENUM ('PENDING', 'MANUAL_FALLBACK', 'PUBLISHING', 'PUBLISHED', 'FAILED');

-- CreateEnum
CREATE TYPE "PlatformPostResultStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'MANUAL_FALLBACK');

-- CreateTable
CREATE TABLE "platform_accounts" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "externalAccountId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "accessTokenEnc" TEXT NOT NULL,
    "refreshTokenEnc" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "status" "PlatformAccountStatus" NOT NULL DEFAULT 'CONNECTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduled_posts" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "clipId" TEXT NOT NULL,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "status" "ScheduledPostStatus" NOT NULL DEFAULT 'SCHEDULED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scheduled_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "publishing_packages" (
    "id" TEXT NOT NULL,
    "scheduledPostId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "clipId" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "platformAccountId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "tags" JSONB NOT NULL,
    "renderedClipAssetId" TEXT NOT NULL,
    "thumbnailAssetId" TEXT,
    "status" "PublishingPackageStatus" NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "publishing_packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_post_results" (
    "id" TEXT NOT NULL,
    "publishingPackageId" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "status" "PlatformPostResultStatus" NOT NULL DEFAULT 'PENDING',
    "platformPostId" TEXT,
    "platformUrl" TEXT,
    "errorMessage" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_post_results_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "platform_accounts_brandId_idx" ON "platform_accounts"("brandId");

-- CreateIndex
CREATE UNIQUE INDEX "platform_accounts_brandId_platform_externalAccountId_key" ON "platform_accounts"("brandId", "platform", "externalAccountId");

-- CreateIndex
CREATE INDEX "scheduled_posts_brandId_idx" ON "scheduled_posts"("brandId");

-- CreateIndex
CREATE INDEX "scheduled_posts_clipId_idx" ON "scheduled_posts"("clipId");

-- CreateIndex
CREATE INDEX "publishing_packages_scheduledPostId_idx" ON "publishing_packages"("scheduledPostId");

-- CreateIndex
CREATE UNIQUE INDEX "platform_post_results_publishingPackageId_key" ON "platform_post_results"("publishingPackageId");

-- AddForeignKey
ALTER TABLE "platform_accounts" ADD CONSTRAINT "platform_accounts_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_posts" ADD CONSTRAINT "scheduled_posts_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_posts" ADD CONSTRAINT "scheduled_posts_clipId_fkey" FOREIGN KEY ("clipId") REFERENCES "clips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publishing_packages" ADD CONSTRAINT "publishing_packages_scheduledPostId_fkey" FOREIGN KEY ("scheduledPostId") REFERENCES "scheduled_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publishing_packages" ADD CONSTRAINT "publishing_packages_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publishing_packages" ADD CONSTRAINT "publishing_packages_clipId_fkey" FOREIGN KEY ("clipId") REFERENCES "clips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publishing_packages" ADD CONSTRAINT "publishing_packages_platformAccountId_fkey" FOREIGN KEY ("platformAccountId") REFERENCES "platform_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publishing_packages" ADD CONSTRAINT "publishing_packages_renderedClipAssetId_fkey" FOREIGN KEY ("renderedClipAssetId") REFERENCES "rendered_clip_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publishing_packages" ADD CONSTRAINT "publishing_packages_thumbnailAssetId_fkey" FOREIGN KEY ("thumbnailAssetId") REFERENCES "thumbnail_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_post_results" ADD CONSTRAINT "platform_post_results_publishingPackageId_fkey" FOREIGN KEY ("publishingPackageId") REFERENCES "publishing_packages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

