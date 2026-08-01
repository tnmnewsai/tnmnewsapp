import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { prisma, Prisma } from "@svt/db";
import { getStorage, renderedClipStorageKey, withLocalFiles } from "@svt/storage";
import { cutClip, renderBrandedClip, type BrandedOverlayInput } from "@svt/render";
import { inngest } from "../client";
import type { BrandTemplateConfig, ClipEditState, ContentApprovalDecidedEvent, TranscriptWord } from "../types";
import { runRenderModerationCheck } from "./run-moderation-check";

export interface ClipRenderRequestedEvent {
  name: "clip/render.requested";
  data: { renderedClipAssetId: string };
}

const ASPECT_RATIO_DIMENSIONS: Record<string, { width: number; height: number }> = {
  "9:16": { width: 1080, height: 1920 },
  "1:1": { width: 1080, height: 1080 },
  "16:9": { width: 1920, height: 1080 },
};

interface RenderResult {
  storageKey: string;
  templateVersion: number | null;
}

interface RenderStepResult extends RenderResult {
  aspectRatio: string;
  durationMs: number;
  /** Only populated for branded renders — "original" cuts skip Gate 1/moderation entirely. */
  captionText: string;
  overlayTexts: string[];
}

async function renderOriginal(
  cutPath: string,
  brandId: string,
  clipId: string,
  renderedClipAssetId: string,
): Promise<RenderResult> {
  const key = renderedClipStorageKey(brandId, clipId, renderedClipAssetId, "mp4");
  await getStorage().putFile(key, cutPath, "video/mp4");
  return { storageKey: key, templateVersion: null };
}

async function renderBranded(
  cutPath: string,
  aspectRatio: string,
  clip: { id: string; brandId: string; editState: unknown },
  segment: { startMs: number; endMs: number },
  transcriptWords: TranscriptWord[],
  renderedClipAssetId: string,
  outputPath: string,
): Promise<RenderResult> {
  const editState = clip.editState as unknown as ClipEditState;
  const dims = ASPECT_RATIO_DIMENSIONS[aspectRatio] ?? ASPECT_RATIO_DIMENSIONS["9:16"];
  if (!dims) throw new Error(`Unknown aspect ratio: ${aspectRatio}`);

  const template = editState.brandTemplateId
    ? await prisma.brandTemplate.findUnique({ where: { id: editState.brandTemplateId } })
    : await prisma.brandTemplate.findFirst({
        where: { brandId: clip.brandId },
        orderBy: { version: "desc" },
      });
  const templateConfig = template?.config as unknown as BrandTemplateConfig | undefined;

  const overlays = editState.overlays ?? [];
  const graphicAssetIds = new Set<string>();
  for (const o of overlays) {
    if (o.type === "image" && o.graphicAssetId) graphicAssetIds.add(o.graphicAssetId);
  }
  if (templateConfig?.logoGraphicAssetId) graphicAssetIds.add(templateConfig.logoGraphicAssetId);

  const graphicAssets = graphicAssetIds.size
    ? await prisma.graphicAsset.findMany({ where: { id: { in: [...graphicAssetIds] } } })
    : [];
  const graphicAssetById = new Map(graphicAssets.map((g) => [g.id, g]));

  const musicTrack = editState.musicTrackId
    ? await prisma.musicTrack.findUnique({ where: { id: editState.musicTrackId } })
    : null;

  const captionWords = transcriptWords
    .filter((w) => w.startMs >= segment.startMs && w.endMs <= segment.endMs)
    .map((w) => ({ word: w.word, startMs: w.startMs - segment.startMs, endMs: w.endMs - segment.startMs }));

  // Gather every distinct storage key we need resolved to a local path at once.
  const keys: string[] = [];
  const keyIndex = (key: string) => {
    const existing = keys.indexOf(key);
    if (existing !== -1) return existing;
    keys.push(key);
    return keys.length - 1;
  };

  const overlayKeyIndexes = overlays.map((o) => {
    if (o.type !== "image" || !o.graphicAssetId) return null;
    const asset = graphicAssetById.get(o.graphicAssetId);
    return asset ? keyIndex(asset.storageKey) : null;
  });
  const logoAsset = templateConfig?.logoGraphicAssetId
    ? graphicAssetById.get(templateConfig.logoGraphicAssetId)
    : undefined;
  const logoKeyIndex = logoAsset ? keyIndex(logoAsset.storageKey) : null;
  const musicKeyIndex = musicTrack ? keyIndex(musicTrack.storageKey) : null;

  await withLocalFiles(getStorage(), keys, async (paths) => {
    const brandedOverlays: BrandedOverlayInput[] = overlays.map((o, i) => {
      const idx = overlayKeyIndexes[i];
      return {
        type: o.type,
        text: o.text,
        position: o.position,
        startMs: o.startMs,
        endMs: o.endMs,
        imagePath: typeof idx === "number" ? paths[idx] : undefined,
      };
    });

    const resolvedLogoPath = logoKeyIndex !== null ? paths[logoKeyIndex] : undefined;

    await renderBrandedClip({
      sourceVideoPath: cutPath,
      durationMs: segment.endMs - segment.startMs,
      width: dims.width,
      height: dims.height,
      captionWords,
      overlays: brandedOverlays,
      template: templateConfig
        ? {
            captionFontSize: templateConfig.captionFontSize,
            captionColor: templateConfig.captionColor,
            captionBackgroundColor: templateConfig.captionBackgroundColor,
            captionPosition: templateConfig.captionPosition,
            accentColor: templateConfig.accentColor,
            logoPath: resolvedLogoPath,
            logoPosition: templateConfig.logoPosition,
          }
        : null,
      musicPath: musicKeyIndex !== null ? paths[musicKeyIndex] : undefined,
      musicVolume: editState.musicVolume,
      outputPath,
    });
  });

  const key = renderedClipStorageKey(clip.brandId, clip.id, renderedClipAssetId, "mp4");
  await getStorage().putFile(key, outputPath, "video/mp4");
  return { storageKey: key, templateVersion: template?.version ?? null };
}

/**
 * Milestone 4 added the plain cut-and-encode path (`aspectRatio: "original"`).
 * Milestone 5 adds the branded path (any other aspect ratio): captions burned
 * in from the transcript, brand-template logo/caption styling, image/text
 * overlays, and mixed-in music — composited with Remotion on top of the same
 * ffmpeg cut. Milestone 6 adds an automated moderation pre-check and a
 * `step.waitForEvent` Gate 1 (content approval) after any branded render —
 * plain "original" cuts aren't meant for publishing, so they skip the gate.
 */
export const renderClip = inngest.createFunction(
  { id: "render-clip", retries: 1 },
  { event: "clip/render.requested" },
  async ({ event, step }) => {
    const { renderedClipAssetId } = event.data as ClipRenderRequestedEvent["data"];

    await step.run("mark-rendering", async () => {
      await prisma.renderedClipAsset.update({
        where: { id: renderedClipAssetId },
        data: { status: "RENDERING" },
      });
    });

    let result: RenderStepResult | null = null;

    try {
      result = await step.run("render", async () => {
        const rendered = await prisma.renderedClipAsset.findUniqueOrThrow({
          where: { id: renderedClipAssetId },
          include: { clip: { include: { sourceAsset: { include: { transcript: true } } } } },
        });

        const { clip } = rendered;
        const source = clip.sourceAsset;
        if (!source.storageKey) throw new Error("Source asset has no stored video.");

        const editState = clip.editState as unknown as ClipEditState;
        const segment = editState.segments[0];
        if (!segment) throw new Error("Clip has no segments to render.");
        const durationMs = segment.endMs - segment.startMs;

        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "svt-render-"));
        try {
          const cutPath = path.join(tempDir, "cut.mp4");
          await getStorage().withLocalFile(source.storageKey, (sourcePath) =>
            cutClip({
              sourceVideoPath: sourcePath,
              startMs: segment.startMs,
              endMs: segment.endMs,
              outputPath: cutPath,
            }),
          );

          if (rendered.aspectRatio === "original") {
            const r = await renderOriginal(cutPath, clip.brandId, clip.id, rendered.id);
            return { ...r, aspectRatio: rendered.aspectRatio, durationMs, captionText: "", overlayTexts: [] };
          }

          const transcriptWords =
            ((source.transcript?.correctedWords ?? source.transcript?.rawWords) as
              | TranscriptWord[]
              | null) ?? [];

          const outputPath = path.join(tempDir, "branded.mp4");
          const r = await renderBranded(
            cutPath,
            rendered.aspectRatio,
            clip,
            segment,
            transcriptWords,
            rendered.id,
            outputPath,
          );

          const captionText = transcriptWords
            .filter((w) => w.startMs >= segment.startMs && w.endMs <= segment.endMs)
            .map((w) => w.word)
            .join(" ");
          const overlayTexts = (editState.overlays ?? [])
            .filter((o) => o.type === "text" && o.text)
            .map((o) => o.text as string);

          return { ...r, aspectRatio: rendered.aspectRatio, durationMs, captionText, overlayTexts };
        } finally {
          fs.rmSync(tempDir, { recursive: true, force: true });
        }
      });

      await step.run("mark-ready", async () => {
        await prisma.renderedClipAsset.update({
          where: { id: renderedClipAssetId },
          data: {
            status: "READY",
            storageKey: result!.storageKey,
            templateVersion: result!.templateVersion,
          },
        });
      });
    } catch (err) {
      // Caught here (not left to Inngest's retry machinery) so a
      // deterministic failure (bad segment, missing source file) surfaces to
      // the user immediately instead of being hammered with retries.
      await step.run("mark-failed", async () => {
        await prisma.renderedClipAsset.update({
          where: { id: renderedClipAssetId },
          data: { status: "FAILED", errorMessage: String(err) },
        });
      });
      return;
    }

    // "original" (plain cut) renders aren't meant for publishing — Gate 1
    // only gates renders that could actually go out the door.
    if (result.aspectRatio === "original") return;

    const moderation = await step.run("run-moderation", async () => {
      try {
        const outcome = await runRenderModerationCheck({
          storageKey: result!.storageKey,
          durationMs: result!.durationMs,
          captionText: result!.captionText,
          overlayTexts: result!.overlayTexts,
        });
        return { failed: false as const, flagged: outcome.flagged, details: outcome.details };
      } catch (err) {
        // A moderation-call failure (e.g. missing OPENAI_API_KEY) shouldn't
        // block human review — it's a pre-check *alongside* a human, not a
        // hard gate — so it's recorded and surfaced, not thrown.
        return { failed: true as const, flagged: null, details: [{ error: String(err) }] };
      }
    });

    await step.run("queue-for-content-review", async () => {
      await prisma.renderedClipAsset.update({
        where: { id: renderedClipAssetId },
        data: {
          moderationStatus: moderation.failed ? "FAILED" : moderation.flagged ? "FLAGGED" : "CLEAR",
          moderationDetails: moderation.details as unknown as Prisma.InputJsonValue,
          contentApprovalStatus: "PENDING_REVIEW",
        },
      });
    });

    const approval = await step.waitForEvent("wait-for-content-approval", {
      event: "clip/content-approval.decided",
      match: "data.renderedClipAssetId",
      timeout: "30d",
    });

    if (!approval) {
      await step.run("mark-approval-timed-out", async () => {
        await prisma.renderedClipAsset.update({
          where: { id: renderedClipAssetId },
          data: { contentApprovalStatus: "REVISION_REQUESTED" },
        });
      });
      return;
    }

    await step.run("apply-content-approval-decision", async () => {
      const { decision, userId, comment } = approval.data as ContentApprovalDecidedEvent["data"];
      const statusByDecision = {
        approved: "APPROVED",
        rejected: "REJECTED",
        revision_requested: "REVISION_REQUESTED",
      } as const;

      await prisma.renderedClipAsset.update({
        where: { id: renderedClipAssetId },
        data: {
          contentApprovalStatus: statusByDecision[decision],
          contentApprovedByUserId: decision === "approved" ? userId : null,
          contentApprovedAt: decision === "approved" ? new Date() : null,
        },
      });

      if (comment) {
        await prisma.reviewComment.create({
          data: { targetType: "RENDERED_CLIP_ASSET", targetId: renderedClipAssetId, authorUserId: userId, body: comment },
        });
      }
    });
  },
);
