import type { Job } from "bullmq";
import { prisma, Prisma } from "@svt/db";
import { generatePostCopyVariants } from "@svt/ai";
import { resolveAiProviderApiKey } from "@svt/workflow";

export interface GeneratePostCopyJobData {
  batchId: string;
}

interface TranscriptWord {
  word: string;
  startMs: number;
  endMs: number;
}

/** Keeps the prompt a reasonable size — a 15-90s clip rarely exceeds this anyway. */
const EXCERPT_WORD_LIMIT = 400;

export async function processGeneratePostCopyJob(job: Job<GeneratePostCopyJobData>): Promise<void> {
  const { batchId } = job.data;
  const batch = await prisma.postCopyBatch.findUniqueOrThrow({
    where: { id: batchId },
    include: { brand: { select: { accountId: true } } },
  });

  await prisma.postCopyBatch.update({ where: { id: batchId }, data: { status: "PROCESSING" } });

  try {
    const clip = await prisma.clip.findUniqueOrThrow({
      where: { id: batch.clipId },
      include: { sourceAsset: { include: { transcript: true } } },
    });

    const editState = clip.editState as unknown as { segments: { startMs: number; endMs: number }[] };
    const segment = editState.segments[0];
    if (!segment) throw new Error("Clip has no segments to draft copy from.");

    const words =
      ((clip.sourceAsset.transcript?.correctedWords ?? clip.sourceAsset.transcript?.rawWords) as
        | TranscriptWord[]
        | null) ?? [];
    const clipWords = words.filter((w) => w.startMs >= segment.startMs && w.endMs <= segment.endMs);
    const transcriptExcerpt = clipWords
      .slice(0, EXCERPT_WORD_LIMIT)
      .map((w) => w.word)
      .join(" ");
    if (!transcriptExcerpt.trim()) throw new Error("This clip's transcript segment has no words yet.");

    const apiKey = await resolveAiProviderApiKey(batch.brand.accountId, "ANTHROPIC");
    const proposals = await generatePostCopyVariants(apiKey, {
      clipTitle: clip.title,
      transcriptExcerpt,
      targetCount: batch.targetCount,
    });

    if (proposals.length === 0) throw new Error("The model returned no copy variants.");

    await prisma.$transaction([
      ...proposals.map((p) =>
        prisma.postCopy.create({
          data: {
            brandId: batch.brandId,
            clipId: batch.clipId,
            batchId,
            text: p.text,
            hashtags: p.hashtags as unknown as Prisma.InputJsonValue,
          },
        }),
      ),
      prisma.postCopyBatch.update({ where: { id: batchId }, data: { status: "READY" } }),
      prisma.clip.update({
        where: { id: batch.clipId },
        data: { publishingApprovalStatus: "PENDING_REVIEW" },
      }),
    ]);
  } catch (err) {
    await prisma.postCopyBatch.update({
      where: { id: batchId },
      data: { status: "FAILED", errorMessage: String(err) },
    });
    throw err;
  }
}
