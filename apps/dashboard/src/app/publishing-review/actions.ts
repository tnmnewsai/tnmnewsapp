"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@svt/db";
import { requireCapability } from "@/lib/current-brand";

export type PublishingDecision = "approved" | "rejected" | "revision_requested";

export async function decidePublishingApproval(
  clipId: string,
  decision: PublishingDecision,
  options: { selectedPostCopyId?: string; comment?: string } = {},
): Promise<void> {
  if (decision === "approved" && !options.selectedPostCopyId) {
    throw new Error("Pick a copy variant to approve.");
  }
  if (decision === "revision_requested" && !options.comment?.trim()) {
    throw new Error("Add a comment explaining what needs to change.");
  }

  const { user, brand } = await requireCapability("post:approve_publishing");

  const clip = await prisma.clip.findFirst({ where: { id: clipId, brandId: brand.id } });
  if (!clip) throw new Error("Clip not found.");
  if (clip.publishingApprovalStatus !== "PENDING_REVIEW") {
    throw new Error("This clip isn't waiting on publishing review anymore.");
  }

  if (decision === "approved") {
    const variant = await prisma.postCopy.findFirst({
      where: { id: options.selectedPostCopyId, clipId },
    });
    if (!variant) throw new Error("Copy variant not found.");

    await prisma.$transaction([
      prisma.postCopy.update({ where: { id: variant.id }, data: { status: "APPROVED" } }),
      prisma.postCopy.updateMany({
        where: { clipId, id: { not: variant.id }, status: "DRAFT" },
        data: { status: "REJECTED" },
      }),
      prisma.clip.update({
        where: { id: clipId },
        data: {
          publishingApprovalStatus: "APPROVED",
          selectedPostCopyId: variant.id,
          publishingApprovedByUserId: user.id,
          publishingApprovedAt: new Date(),
        },
      }),
    ]);
  } else {
    await prisma.$transaction([
      prisma.postCopy.updateMany({ where: { clipId, status: "DRAFT" }, data: { status: "REJECTED" } }),
      prisma.clip.update({
        where: { id: clipId },
        data: {
          publishingApprovalStatus: decision === "rejected" ? "REJECTED" : "REVISION_REQUESTED",
          selectedPostCopyId: null,
          publishingApprovedByUserId: null,
          publishingApprovedAt: null,
        },
      }),
    ]);

    if (options.comment?.trim()) {
      await prisma.reviewComment.create({
        data: { targetType: "CLIP", targetId: clipId, authorUserId: user.id, body: options.comment.trim() },
      });
    }
  }

  revalidatePath("/publishing-review");
  revalidatePath(`/sources/${clip.sourceAssetId}/clips/${clipId}`);
}
