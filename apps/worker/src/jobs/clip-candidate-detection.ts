import type { Job } from "bullmq";
import { prisma } from "@svt/db";
import { detectClipCandidates } from "@svt/ai";
import { resolveAiProviderApiKey } from "@svt/workflow";

export interface ClipCandidateDetectionJobData {
  batchId: string;
}

interface TranscriptWord {
  word: string;
  startMs: number;
  endMs: number;
}

export async function processClipCandidateDetectionJob(
  job: Job<ClipCandidateDetectionJobData>,
): Promise<void> {
  const { batchId } = job.data;
  const batch = await prisma.clipCandidateBatch.findUniqueOrThrow({
    where: { id: batchId },
    include: { brand: { select: { accountId: true } } },
  });

  await prisma.clipCandidateBatch.update({ where: { id: batchId }, data: { status: "PROCESSING" } });

  try {
    const source = await prisma.sourceAsset.findUniqueOrThrow({
      where: { id: batch.sourceAssetId },
      include: { transcript: true },
    });

    const words =
      ((source.transcript?.correctedWords ?? source.transcript?.rawWords) as
        | TranscriptWord[]
        | null) ?? [];
    if (words.length === 0) throw new Error("Transcript has no words to analyze yet.");

    const apiKey = await resolveAiProviderApiKey(batch.brand.accountId, "ANTHROPIC");
    const proposals = await detectClipCandidates(apiKey, {
      words,
      targetCount: batch.targetCount,
      durationMs: source.durationMs ?? undefined,
    });

    if (proposals.length === 0) throw new Error("The model returned no candidates.");

    await prisma.$transaction(
      proposals.map((p) =>
        prisma.clipCandidate.create({
          data: {
            brandId: batch.brandId,
            sourceAssetId: batch.sourceAssetId,
            startMs: p.startMs,
            endMs: p.endMs,
            title: p.title,
            rationale: p.rationale,
            confidence: p.confidence,
          },
        }),
      ),
    );

    await prisma.clipCandidateBatch.update({ where: { id: batchId }, data: { status: "READY" } });
  } catch (err) {
    await prisma.clipCandidateBatch.update({
      where: { id: batchId },
      data: { status: "FAILED", errorMessage: String(err) },
    });
    throw err;
  }
}
