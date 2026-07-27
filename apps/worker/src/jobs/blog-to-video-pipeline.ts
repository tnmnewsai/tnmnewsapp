import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { prisma, Prisma } from "@svt/db";
import { fetchBlogArticle } from "@svt/ingestion";
import { generateVideoScript } from "@svt/ai";
import { synthesizeNarration, concatenateAudioFiles, probeAudioDurationMs } from "@svt/tts";
import { generateSegmentImage } from "@svt/image-gen";
import { renderBlogVideo } from "@svt/render";
import { transcribeWithWhisper } from "@svt/transcription";
import { getStorage, sourceAssetStorageKey } from "@svt/storage";
import { resolveAiProviderApiKey } from "@svt/workflow";

const VIDEO_WIDTH = 1080;
const VIDEO_HEIGHT = 1920;

function withTempDir<T>(prefix: string, fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  return fn(dir).finally(() => fs.rmSync(dir, { recursive: true, force: true }));
}

/**
 * Blog-to-video's "import" step: article -> AI script -> per-segment TTS +
 * AI image -> assembled video -> Whisper re-transcription of the narration.
 * Once this reaches the end, the SourceAsset+Transcript pair is
 * indistinguishable from one that started as real footage — the rest of
 * the app (manual clip creation, AI clip-candidate detection, rendering,
 * branding, both approval gates, publishing, scheduling, analytics) needs
 * no changes at all.
 */
export async function processBlogToVideoPipeline(sourceAssetId: string): Promise<void> {
  const asset = await prisma.sourceAsset.findUniqueOrThrow({
    where: { id: sourceAssetId },
    include: { brand: { select: { accountId: true } } },
  });
  if (asset.status === "READY" && asset.storageKey) return;

  await prisma.sourceAsset.update({ where: { id: asset.id }, data: { status: "FETCHING" } });

  const accountId = asset.brand.accountId;

  try {
    const blogArticle = await ensureArticleFetched(asset.id, asset.sourceUrl);
    const segments = await ensureScriptGenerated(asset.id, blogArticle, accountId);

    await withTempDir("svt-blogvideo-", async (tempDir) => {
      const openAiKey = await resolveAiProviderApiKey(accountId, "OPENAI");
      const segmentFiles: { imagePath: string; durationMs: number }[] = [];
      const audioPaths: string[] = [];

      for (const segment of segments) {
        const audioPath = path.join(tempDir, `audio-${segment.order}.mp3`);
        const imagePath = path.join(tempDir, `image-${segment.order}.jpg`);

        await synthesizeNarration(openAiKey, { text: segment.narrationText, outputPath: audioPath });
        const durationMs = await probeAudioDurationMs(audioPath);
        await generateSegmentImage({
          prompt: segment.visualPrompt,
          width: VIDEO_WIDTH,
          height: VIDEO_HEIGHT,
          outputPath: imagePath,
          seed: segment.order,
        });

        await prisma.scriptSegment.update({ where: { id: segment.id }, data: { durationMs } });
        audioPaths.push(audioPath);
        segmentFiles.push({ imagePath, durationMs });
      }

      const narrationPath = path.join(tempDir, "narration.mp3");
      await concatenateAudioFiles(audioPaths, narrationPath);

      const videoPath = path.join(tempDir, "blog-video.mp4");
      await renderBlogVideo({
        audioPath: narrationPath,
        segments: segmentFiles,
        width: VIDEO_WIDTH,
        height: VIDEO_HEIGHT,
        outputPath: videoPath,
      });

      const key = sourceAssetStorageKey(asset.brandId, asset.id, "mp4");
      await getStorage().putFile(key, videoPath);

      const totalDurationMs = segmentFiles.reduce((sum, s) => sum + s.durationMs, 0);
      await prisma.sourceAsset.update({
        where: { id: asset.id },
        data: {
          status: "READY",
          storageKey: key,
          durationMs: totalDurationMs,
          originalFilename: `${blogArticle.title}.mp4`,
        },
      });

      await transcribeNarration(sourceAssetId, narrationPath, openAiKey);
    });
  } catch (err) {
    await prisma.sourceAsset.update({
      where: { id: asset.id },
      data: { status: "FAILED", errorMessage: String(err) },
    });
    throw err;
  }
}

async function ensureArticleFetched(sourceAssetId: string, sourceUrl: string | null) {
  const existing = await prisma.blogArticle.findUnique({ where: { sourceAssetId } });
  if (existing) return existing;

  if (!sourceUrl) throw new Error("Blog source asset is missing sourceUrl");
  const fetched = await fetchBlogArticle(sourceUrl);
  return prisma.blogArticle.create({
    data: { sourceAssetId, title: fetched.title, bodyText: fetched.bodyText },
  });
}

async function ensureScriptGenerated(
  sourceAssetId: string,
  article: { title: string; bodyText: string },
  accountId: string,
) {
  let videoScript = await prisma.videoScript.findUnique({
    where: { sourceAssetId },
    include: { segments: { orderBy: { order: "asc" } } },
  });

  if (!videoScript) {
    videoScript = await prisma.videoScript.create({
      data: { sourceAssetId, status: "PROCESSING" },
      include: { segments: { orderBy: { order: "asc" } } },
    });
  }

  if (videoScript.segments.length > 0) return videoScript.segments;

  try {
    const apiKey = await resolveAiProviderApiKey(accountId, "ANTHROPIC");
    const proposals = await generateVideoScript(apiKey, { title: article.title, bodyText: article.bodyText });
    await prisma.$transaction(
      proposals.map((p, i) =>
        prisma.scriptSegment.create({
          data: {
            videoScriptId: videoScript!.id,
            order: i,
            narrationText: p.narrationText,
            visualPrompt: p.visualPrompt,
          },
        }),
      ),
    );
    await prisma.videoScript.update({ where: { id: videoScript.id }, data: { status: "READY" } });
  } catch (err) {
    await prisma.videoScript.update({
      where: { id: videoScript.id },
      data: { status: "FAILED", errorMessage: String(err) },
    });
    throw err;
  }

  return prisma.scriptSegment.findMany({
    where: { videoScriptId: videoScript.id },
    orderBy: { order: "asc" },
  });
}

async function transcribeNarration(sourceAssetId: string, narrationPath: string, apiKey: string): Promise<void> {
  await prisma.transcript.upsert({
    where: { sourceAssetId },
    update: { status: "PROCESSING" },
    create: { sourceAssetId, provider: "openai-whisper", status: "PROCESSING" },
  });

  try {
    const result = await transcribeWithWhisper(apiKey, narrationPath);
    await prisma.transcript.update({
      where: { sourceAssetId },
      data: {
        status: "READY",
        provider: result.provider,
        language: result.language,
        rawWords: result.words as unknown as Prisma.InputJsonValue,
      },
    });
  } catch (err) {
    await prisma.transcript.update({
      where: { sourceAssetId },
      data: { status: "FAILED", errorMessage: String(err) },
    });
    throw err;
  }
}
