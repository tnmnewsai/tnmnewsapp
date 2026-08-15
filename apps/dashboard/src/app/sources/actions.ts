"use server";

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma, Prisma, type SourceAssetType } from "@svt/db";
import { getStorage, sourceAssetStorageKey } from "@svt/storage";
import { createQueue, QUEUE_NAMES } from "@svt/queue";
import { inngest, type ClipEditState, type ClipOverlay } from "@svt/workflow/client";
import { buildPackageContent, type Platform } from "@svt/publishing-core";
import { requireCapability, requireCurrentBrand, requireCurrentUser } from "@/lib/current-brand";
import { dayBoundsUTC } from "@/lib/schedule-day";

export async function createSourceAsset(formData: FormData): Promise<void> {
  const type = formData.get("type") as SourceAssetType;
  const rightsAttestation = formData.get("rightsAttestation") === "on";

  if (!rightsAttestation) {
    throw new Error("You must confirm you have the rights to use this content.");
  }

  const brand = await requireCurrentBrand();
  const user = await requireCurrentUser();

  let sourceAssetId: string;

  if (type === "VIDEO_UPLOAD") {
    const file = formData.get("file") as File | null;
    if (!file || file.size === 0) throw new Error("Choose a video file to upload.");

    const created = await prisma.sourceAsset.create({
      data: {
        brandId: brand.id,
        type,
        originalFilename: file.name,
        rightsAttestation: true,
        createdByUserId: user.id,
      },
    });

    const ext = path.extname(file.name).replace(".", "") || "mp4";
    const tempPath = path.join(os.tmpdir(), `svt-upload-${created.id}.${ext}`);
    fs.writeFileSync(tempPath, Buffer.from(await file.arrayBuffer()));

    const key = sourceAssetStorageKey(brand.id, created.id, ext);
    await getStorage().putFile(key, tempPath);
    fs.rmSync(tempPath, { force: true });

    await prisma.sourceAsset.update({
      where: { id: created.id },
      data: { status: "READY", storageKey: key },
    });

    sourceAssetId = created.id;
  } else {
    const url = (formData.get("url") as string | null)?.trim();
    if (!url) throw new Error("Enter a source URL.");

    const created = await prisma.sourceAsset.create({
      data: {
        brandId: brand.id,
        type,
        sourceUrl: url,
        rightsAttestation: true,
        createdByUserId: user.id,
      },
    });

    sourceAssetId = created.id;
  }

  const queue = createQueue<{ sourceAssetId: string }>(QUEUE_NAMES.sourceAssetPipeline, brand.id);
  await queue.add("process", { sourceAssetId });

  revalidatePath("/sources");
  redirect(`/sources/${sourceAssetId}`);
}

export async function prepareSourceVideoUpload(input: {
  filename: string;
  contentType: string;
  size: number;
}): Promise<{ sourceAssetId: string; uploadUrl: string }> {
  const startedAt = Date.now();
  const brand = await requireCurrentBrand();
  const user = await requireCurrentUser();
  const filename = path.basename(input.filename).slice(0, 255);
  const contentType = input.contentType || "application/octet-stream";

  if (!filename || !contentType.startsWith("video/") || input.size <= 0) {
    throw new Error("Choose a valid video file to upload.");
  }

  const created = await prisma.sourceAsset.create({
    data: {
      brandId: brand.id,
      type: "VIDEO_UPLOAD",
      originalFilename: filename,
      rightsAttestation: true,
      createdByUserId: user.id,
    },
  });

  const rawExt = path.extname(filename).replace(".", "").toLowerCase();
  const ext = /^[a-z0-9]{1,10}$/.test(rawExt) ? rawExt : "mp4";
  const key = sourceAssetStorageKey(brand.id, created.id, ext);
  const uploadUrl = await getStorage().getUploadUrl(key, contentType);

  if (!uploadUrl) {
    await prisma.sourceAsset.delete({ where: { id: created.id } });
    throw new Error("Direct video uploads require S3-compatible storage.");
  }

  await prisma.sourceAsset.update({ where: { id: created.id }, data: { storageKey: key } });
  console.log(JSON.stringify({ level: "info", msg: "video upload prepared", sourceAssetId: created.id, size: input.size, ms: Date.now() - startedAt }));
  return { sourceAssetId: created.id, uploadUrl };
}

export async function completeSourceVideoUpload(sourceAssetId: string): Promise<string> {
  const startedAt = Date.now();
  const brand = await requireCurrentBrand();
  const source = await prisma.sourceAsset.findFirst({
    where: { id: sourceAssetId, brandId: brand.id, type: "VIDEO_UPLOAD" },
  });
  if (!source?.storageKey) throw new Error("The pending video upload was not found.");
  if (!(await getStorage().exists(source.storageKey))) {
    throw new Error("The video did not finish uploading. Please try again.");
  }

  await prisma.sourceAsset.update({ where: { id: source.id }, data: { status: "READY" } });
  const queue = createQueue<{ sourceAssetId: string }>(QUEUE_NAMES.sourceAssetPipeline, brand.id);
  await queue.add("process", { sourceAssetId: source.id });
  revalidatePath("/sources");
  console.log(JSON.stringify({ level: "info", msg: "video upload completed", sourceAssetId: source.id, ms: Date.now() - startedAt }));
  return source.id;
}

interface TranscriptWordInput {
  word: string;
  startMs: number;
  endMs: number;
  confidence?: number;
}

export async function saveTranscriptCorrection(
  sourceAssetId: string,
  words: TranscriptWordInput[],
): Promise<void> {
  const brand = await requireCurrentBrand();
  const source = await prisma.sourceAsset.findFirst({
    where: { id: sourceAssetId, brandId: brand.id },
  });
  if (!source) throw new Error("Source not found.");

  await prisma.transcript.update({
    where: { sourceAssetId },
    data: { correctedWords: words as unknown as Prisma.InputJsonValue },
  });

  revalidatePath(`/sources/${sourceAssetId}`);
}

export interface ClipRangeInput {
  title: string;
  startMs: number;
  endMs: number;
}

function validateRange({ title, startMs, endMs }: ClipRangeInput) {
  if (!title.trim()) throw new Error("Give the clip a title.");
  if (endMs <= startMs) throw new Error("End must be after start.");
}

export async function createClip(
  sourceAssetId: string,
  input: ClipRangeInput,
): Promise<string> {
  validateRange(input);
  const brand = await requireCurrentBrand();
  const user = await requireCurrentUser();

  const source = await prisma.sourceAsset.findFirst({
    where: { id: sourceAssetId, brandId: brand.id },
  });
  if (!source) throw new Error("Source not found.");

  const clip = await prisma.clip.create({
    data: {
      brandId: brand.id,
      sourceAssetId,
      title: input.title,
      editState: { segments: [{ startMs: input.startMs, endMs: input.endMs }] },
      createdByUserId: user.id,
    },
  });

  revalidatePath(`/sources/${sourceAssetId}`);
  return clip.id;
}

export async function updateClip(clipId: string, input: ClipRangeInput): Promise<void> {
  validateRange(input);
  const brand = await requireCurrentBrand();

  const clip = await prisma.clip.findFirst({ where: { id: clipId, brandId: brand.id } });
  if (!clip) throw new Error("Clip not found.");

  await prisma.clip.update({
    where: { id: clipId },
    data: {
      title: input.title,
      editState: { segments: [{ startMs: input.startMs, endMs: input.endMs }] },
    },
  });

  revalidatePath(`/sources/${clip.sourceAssetId}`);
  revalidatePath(`/sources/${clip.sourceAssetId}/clips/${clipId}`);
}

export async function deleteClip(clipId: string): Promise<{ sourceAssetId: string }> {
  const brand = await requireCurrentBrand();

  const clip = await prisma.clip.findFirst({ where: { id: clipId, brandId: brand.id } });
  if (!clip) throw new Error("Clip not found.");

  await prisma.clip.delete({ where: { id: clipId } });
  revalidatePath(`/sources/${clip.sourceAssetId}`);
  return { sourceAssetId: clip.sourceAssetId };
}

export async function requestClipCandidates(
  sourceAssetId: string,
  targetCount: number,
): Promise<void> {
  if (!Number.isInteger(targetCount) || targetCount < 1 || targetCount > 10) {
    throw new Error("Choose a number of clips between 1 and 10.");
  }

  const brand = await requireCurrentBrand();
  const source = await prisma.sourceAsset.findFirst({
    where: { id: sourceAssetId, brandId: brand.id },
    include: { transcript: true },
  });
  if (!source) throw new Error("Source not found.");
  if (source.transcript?.status !== "READY") {
    throw new Error("The transcript needs to finish processing first.");
  }

  const batch = await prisma.clipCandidateBatch.create({
    data: { brandId: brand.id, sourceAssetId, targetCount },
  });

  const queue = createQueue<{ batchId: string }>(QUEUE_NAMES.clipCandidateDetection, brand.id);
  await queue.add("detect", { batchId: batch.id });

  revalidatePath(`/sources/${sourceAssetId}`);
}

export async function acceptClipCandidate(candidateId: string): Promise<string> {
  const brand = await requireCurrentBrand();
  const user = await requireCurrentUser();

  const candidate = await prisma.clipCandidate.findFirst({
    where: { id: candidateId, brandId: brand.id },
  });
  if (!candidate) throw new Error("Candidate not found.");

  const clip = await prisma.$transaction(async (tx) => {
    const created = await tx.clip.create({
      data: {
        brandId: brand.id,
        sourceAssetId: candidate.sourceAssetId,
        clipCandidateId: candidate.id,
        title: candidate.title,
        editState: { segments: [{ startMs: candidate.startMs, endMs: candidate.endMs }] },
        createdByUserId: user.id,
      },
    });
    await tx.clipCandidate.update({ where: { id: candidate.id }, data: { status: "ACCEPTED" } });
    return created;
  });

  revalidatePath(`/sources/${candidate.sourceAssetId}`);
  return clip.id;
}

export async function rejectClipCandidate(candidateId: string): Promise<void> {
  const brand = await requireCurrentBrand();
  const candidate = await prisma.clipCandidate.findFirst({
    where: { id: candidateId, brandId: brand.id },
  });
  if (!candidate) throw new Error("Candidate not found.");

  await prisma.clipCandidate.update({ where: { id: candidateId }, data: { status: "REJECTED" } });
  revalidatePath(`/sources/${candidate.sourceAssetId}`);
}

export async function requestClipRender(clipId: string, aspectRatio: string): Promise<void> {
  const brand = await requireCurrentBrand();
  const clip = await prisma.clip.findFirst({ where: { id: clipId, brandId: brand.id } });
  if (!clip) throw new Error("Clip not found.");

  const rendered = await prisma.renderedClipAsset.create({
    data: { clipId, aspectRatio },
  });

  await inngest.send({
    name: "clip/render.requested",
    data: { renderedClipAssetId: rendered.id },
  });

  revalidatePath(`/sources/${clip.sourceAssetId}/clips/${clipId}`);
}

export interface ClipBrandingInput {
  overlays: ClipOverlay[];
  musicTrackId?: string;
  musicVolume?: number;
  brandTemplateId?: string;
}

export async function saveClipBranding(clipId: string, input: ClipBrandingInput): Promise<void> {
  const brand = await requireCurrentBrand();
  const clip = await prisma.clip.findFirst({ where: { id: clipId, brandId: brand.id } });
  if (!clip) throw new Error("Clip not found.");

  const editState = clip.editState as unknown as ClipEditState;
  const updated: ClipEditState = {
    ...editState,
    overlays: input.overlays,
    musicTrackId: input.musicTrackId,
    musicVolume: input.musicVolume,
    brandTemplateId: input.brandTemplateId,
  };

  await prisma.clip.update({
    where: { id: clipId },
    data: { editState: updated as unknown as Prisma.InputJsonValue },
  });

  revalidatePath(`/sources/${clip.sourceAssetId}/clips/${clipId}`);
}

export interface CreateThumbnailInput {
  titleText: string;
  descriptionText: string;
  sourceRenderedClipAssetId?: string;
  sourceFrameMs?: number;
  customBaseImageGraphicAssetId?: string;
}

export async function createThumbnailAsset(clipId: string, input: CreateThumbnailInput): Promise<void> {
  if (!input.titleText.trim()) throw new Error("Give the thumbnail a title.");
  if (!input.sourceRenderedClipAssetId && !input.customBaseImageGraphicAssetId) {
    throw new Error("Pick a frame from a render or a custom base image.");
  }

  const brand = await requireCurrentBrand();
  const clip = await prisma.clip.findFirst({ where: { id: clipId, brandId: brand.id } });
  if (!clip) throw new Error("Clip not found.");

  const thumbnail = await prisma.thumbnailAsset.create({
    data: {
      clipId,
      titleText: input.titleText.trim(),
      descriptionText: input.descriptionText.trim(),
      sourceRenderedClipAssetId: input.sourceRenderedClipAssetId,
      sourceFrameMs: input.sourceFrameMs,
      customBaseImageGraphicAssetId: input.customBaseImageGraphicAssetId,
    },
  });

  const queue = createQueue<{ thumbnailAssetId: string }>(QUEUE_NAMES.generateThumbnail, brand.id);
  await queue.add("generate", { thumbnailAssetId: thumbnail.id });

  revalidatePath(`/sources/${clip.sourceAssetId}/clips/${clipId}`);
}

export async function requestPostCopyVariants(clipId: string, targetCount: number): Promise<void> {
  if (!Number.isInteger(targetCount) || targetCount < 1 || targetCount > 8) {
    throw new Error("Choose a number of copy variants between 1 and 8.");
  }

  const brand = await requireCurrentBrand();
  const clip = await prisma.clip.findFirst({ where: { id: clipId, brandId: brand.id } });
  if (!clip) throw new Error("Clip not found.");

  const batch = await prisma.postCopyBatch.create({ data: { brandId: brand.id, clipId, targetCount } });

  const queue = createQueue<{ batchId: string }>(QUEUE_NAMES.generatePostCopy, brand.id);
  await queue.add("generate", { batchId: batch.id });

  revalidatePath(`/sources/${clip.sourceAssetId}/clips/${clipId}`);
}

export async function deleteThumbnailAsset(thumbnailAssetId: string): Promise<void> {
  const brand = await requireCurrentBrand();
  const thumbnail = await prisma.thumbnailAsset.findFirst({
    where: { id: thumbnailAssetId, clip: { brandId: brand.id } },
    include: { clip: true },
  });
  if (!thumbnail) throw new Error("Thumbnail not found.");

  await prisma.thumbnailAsset.delete({ where: { id: thumbnailAssetId } });
  revalidatePath(`/sources/${thumbnail.clip.sourceAssetId}/clips/${thumbnail.clipId}`);
}

export interface SchedulePublishingInput {
  /** ISO datetime string. */
  scheduledFor: string;
  platforms: Platform[];
}

/**
 * Creates one ScheduledPost with a PublishingPackage per selected platform.
 * A platform with a CONNECTED PlatformAccount gets a real (PENDING) package
 * that the Inngest publish workflow picks up; everything else gets its
 * content mechanically packaged too, just routed straight to
 * MANUAL_FALLBACK — no adapter required for that path.
 */
export async function scheduleClipForPublishing(
  clipId: string,
  input: SchedulePublishingInput,
): Promise<void> {
  if (input.platforms.length === 0) throw new Error("Pick at least one platform.");

  const { brand } = await requireCapability("schedule:manage");

  const clip = await prisma.clip.findFirst({
    where: { id: clipId, brandId: brand.id },
    include: {
      selectedPostCopy: true,
      renderedAssets: {
        where: { status: "READY", aspectRatio: { not: "original" } },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      thumbnailAssets: { where: { status: "READY" }, orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  if (!clip) throw new Error("Clip not found.");

  const selectedPostCopy = clip.selectedPostCopy;
  if (clip.publishingApprovalStatus !== "APPROVED" || !selectedPostCopy) {
    throw new Error("This clip hasn't passed publishing approval (Gate 2) yet.");
  }

  const rendered = clip.renderedAssets[0];
  if (!rendered) throw new Error("No ready branded render to publish.");

  const thumbnail = clip.thumbnailAssets[0];

  const scheduledForDate = new Date(input.scheduledFor);
  if (Number.isNaN(scheduledForDate.getTime())) throw new Error("Invalid schedule date.");

  // Locked model: one canonical clip per day per brand, posted everywhere —
  // not a per-platform stagger, so a day either has zero or one ScheduledPost.
  const { start, end } = dayBoundsUTC(scheduledForDate);
  const collision = await prisma.scheduledPost.findFirst({
    where: { brandId: brand.id, scheduledFor: { gte: start, lt: end } },
  });
  if (collision) {
    throw new Error("This brand already has a clip scheduled for that day — pick a different day.");
  }

  const accounts = await prisma.platformAccount.findMany({
    where: { brandId: brand.id, platform: { in: input.platforms }, status: "CONNECTED" },
  });
  const accountByPlatform = new Map(accounts.map((a) => [a.platform, a]));

  const hashtags = Array.isArray(selectedPostCopy.hashtags) ? (selectedPostCopy.hashtags as string[]) : [];

  // No Inngest event to send here — the check-scheduled-posts cron sweep
  // picks this row up once its scheduledFor day actually arrives, which is
  // also what makes reassigning/cancelling it later a plain DB write.
  await prisma.$transaction(async (tx) => {
    const post = await tx.scheduledPost.create({
      data: { brandId: brand.id, clipId, scheduledFor: scheduledForDate },
    });

    for (const platform of input.platforms) {
      const content = buildPackageContent(platform, {
        clipTitle: clip.title,
        postCopyText: selectedPostCopy.text,
        hashtags,
      });
      const account = accountByPlatform.get(platform);

      await tx.publishingPackage.create({
        data: {
          scheduledPostId: post.id,
          brandId: brand.id,
          clipId,
          platform,
          platformAccountId: account?.id,
          title: content.title,
          description: content.description,
          tags: content.tags,
          renderedClipAssetId: rendered.id,
          thumbnailAssetId: thumbnail?.id,
          status: account ? "PENDING" : "MANUAL_FALLBACK",
        },
      });
    }
  });

  revalidatePath(`/sources/${clip.sourceAssetId}/clips/${clipId}`);
  revalidatePath("/calendar");
}
