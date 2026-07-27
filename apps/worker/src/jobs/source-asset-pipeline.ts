import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Job } from "bullmq";
import { prisma, Prisma } from "@svt/db";
import { fetchYouTubeVideo, fetchDriveVideo } from "@svt/ingestion";
import { getStorage, sourceAssetStorageKey } from "@svt/storage";
import { extractAudio, transcribeWithWhisper } from "@svt/transcription";
import { resolveAiProviderApiKey } from "@svt/workflow";
import { processBlogToVideoPipeline } from "./blog-to-video-pipeline";

export interface SourceAssetJobData {
  sourceAssetId: string;
}

function withTempDir<T>(prefix: string, fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  return fn(dir).finally(() => fs.rmSync(dir, { recursive: true, force: true }));
}

async function ensureFetched(sourceAssetId: string): Promise<void> {
  const asset = await prisma.sourceAsset.findUniqueOrThrow({ where: { id: sourceAssetId } });
  if (asset.status === "READY" && asset.storageKey) return; // already fetched (e.g. direct upload)

  await prisma.sourceAsset.update({ where: { id: asset.id }, data: { status: "FETCHING" } });

  try {
    await withTempDir("svt-ingest-", async (tempDir) => {
      if (asset.type === "YOUTUBE_LINK") {
        if (!asset.sourceUrl) throw new Error("YouTube source asset is missing sourceUrl");
        const media = await fetchYouTubeVideo(asset.sourceUrl, tempDir);
        const key = sourceAssetStorageKey(asset.brandId, asset.id, media.ext);
        await getStorage().putFile(key, media.localPath);
        await prisma.sourceAsset.update({
          where: { id: asset.id },
          data: {
            status: "READY",
            storageKey: key,
            durationMs: media.durationMs,
            originalFilename: media.originalFilename,
          },
        });
      } else if (asset.type === "DRIVE_LINK") {
        if (!asset.sourceUrl) throw new Error("Drive source asset is missing sourceUrl");
        const media = await fetchDriveVideo(asset.sourceUrl, tempDir);
        const key = sourceAssetStorageKey(asset.brandId, asset.id, media.ext);
        await getStorage().putFile(key, media.localPath);
        await prisma.sourceAsset.update({
          where: { id: asset.id },
          data: { status: "READY", storageKey: key, durationMs: media.durationMs },
        });
      } else {
        throw new Error(`Don't know how to fetch source asset type: ${asset.type}`);
      }
    });
  } catch (err) {
    await prisma.sourceAsset.update({
      where: { id: asset.id },
      data: { status: "FAILED", errorMessage: String(err) },
    });
    throw err;
  }
}

async function transcribe(sourceAssetId: string): Promise<void> {
  const asset = await prisma.sourceAsset.findUniqueOrThrow({
    where: { id: sourceAssetId },
    include: { brand: { select: { accountId: true } } },
  });
  if (!asset.storageKey) return; // fetch stage failed — nothing to transcribe

  await prisma.transcript.upsert({
    where: { sourceAssetId },
    update: { status: "PROCESSING" },
    create: { sourceAssetId, provider: "openai-whisper", status: "PROCESSING" },
  });

  try {
    const apiKey = await resolveAiProviderApiKey(asset.brand.accountId, "OPENAI");
    await getStorage().withLocalFile(asset.storageKey, (localVideoPath) =>
      withTempDir("svt-transcribe-", async (tempDir) => {
        const audioPath = await extractAudio(localVideoPath, tempDir);
        const result = await transcribeWithWhisper(apiKey, audioPath);
        await prisma.transcript.update({
          where: { sourceAssetId },
          data: {
            status: "READY",
            provider: result.provider,
            language: result.language,
            rawWords: result.words as unknown as Prisma.InputJsonValue,
          },
        });
      }),
    );
  } catch (err) {
    await prisma.transcript.update({
      where: { sourceAssetId },
      data: { status: "FAILED", errorMessage: String(err) },
    });
    throw err;
  }
}

export async function processSourceAssetJob(job: Job<SourceAssetJobData>): Promise<void> {
  const { sourceAssetId } = job.data;

  const asset = await prisma.sourceAsset.findUniqueOrThrow({ where: { id: sourceAssetId } });
  if (asset.type === "BLOG_URL") {
    // Blog-to-video builds its own "footage" (article -> script -> TTS ->
    // images -> render) and its own Transcript (Whisper re-transcription of
    // the narration) in one pass — it doesn't go through ensureFetched/
    // transcribe below, which assume real footage already exists to fetch.
    await processBlogToVideoPipeline(sourceAssetId);
    return;
  }

  await ensureFetched(sourceAssetId);
  await transcribe(sourceAssetId);
}
