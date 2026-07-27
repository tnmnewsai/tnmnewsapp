import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Job } from "bullmq";
import { prisma } from "@svt/db";
import { getStorage, thumbnailAssetStorageKey } from "@svt/storage";
import { extractFrame, renderThumbnail } from "@svt/render";

export interface GenerateThumbnailJobData {
  thumbnailAssetId: string;
}

const ASPECT_RATIO_DIMENSIONS: Record<string, { width: number; height: number }> = {
  "9:16": { width: 1080, height: 1920 },
  "1:1": { width: 1080, height: 1080 },
  "16:9": { width: 1920, height: 1080 },
  original: { width: 1080, height: 1920 },
};

function withTempDir<T>(prefix: string, fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  return fn(dir).finally(() => fs.rmSync(dir, { recursive: true, force: true }));
}

export async function processGenerateThumbnailJob(job: Job<GenerateThumbnailJobData>): Promise<void> {
  const { thumbnailAssetId } = job.data;

  const thumbnail = await prisma.thumbnailAsset.findUniqueOrThrow({
    where: { id: thumbnailAssetId },
    include: { clip: true, sourceRenderedClipAsset: true, customBaseImageGraphicAsset: true },
  });

  await prisma.thumbnailAsset.update({ where: { id: thumbnailAssetId }, data: { status: "RENDERING" } });

  try {
    await withTempDir("svt-thumbnail-", async (tempDir) => {
      const { clip } = thumbnail;

      let dims = ASPECT_RATIO_DIMENSIONS.original as { width: number; height: number };

      const baseImagePath = await (async () => {
        if (thumbnail.sourceRenderedClipAsset) {
          const rendered = thumbnail.sourceRenderedClipAsset;
          if (!rendered.storageKey) throw new Error("Source render has no stored video yet.");
          dims = ASPECT_RATIO_DIMENSIONS[rendered.aspectRatio] ?? dims;

          const framePath = path.join(tempDir, "frame.png");
          await getStorage().withLocalFile(rendered.storageKey, (videoPath) =>
            extractFrame({ sourceVideoPath: videoPath, atMs: thumbnail.sourceFrameMs ?? 0, outputPath: framePath }),
          );
          return framePath;
        }

        if (thumbnail.customBaseImageGraphicAsset) {
          const graphic = thumbnail.customBaseImageGraphicAsset;
          const localPath = path.join(tempDir, `custom${path.extname(graphic.storageKey) || ".png"}`);
          await getStorage().withLocalFile(graphic.storageKey, (resolvedPath) => {
            fs.copyFileSync(resolvedPath, localPath);
            return Promise.resolve();
          });
          return localPath;
        }

        throw new Error("Thumbnail has neither a source render frame nor a custom base image.");
      })();

      // Match the brand's current accent color, if one exists, for visual consistency with branded renders.
      const template = await prisma.brandTemplate.findFirst({
        where: { brandId: clip.brandId },
        orderBy: { version: "desc" },
      });
      const templateConfig = template?.config as { accentColor?: string } | undefined;

      const outputPath = path.join(tempDir, "thumbnail.png");
      await renderThumbnail({
        baseImagePath,
        width: dims.width,
        height: dims.height,
        titleText: thumbnail.titleText,
        descriptionText: thumbnail.descriptionText,
        accentColor: templateConfig?.accentColor,
        outputPath,
      });

      const key = thumbnailAssetStorageKey(clip.brandId, clip.id, thumbnail.id, "png");
      await getStorage().putFile(key, outputPath, "image/png");

      await prisma.thumbnailAsset.update({
        where: { id: thumbnailAssetId },
        data: { status: "READY", storageKey: key, errorMessage: null },
      });
    });
  } catch (err) {
    await prisma.thumbnailAsset.update({
      where: { id: thumbnailAssetId },
      data: { status: "FAILED", errorMessage: String(err) },
    });
    throw err;
  }
}
