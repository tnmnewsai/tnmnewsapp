"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@svt/db";
import { inngest, type ContentApprovalDecision } from "@svt/workflow/client";
import { requireCapability } from "@/lib/current-brand";

export async function decideContentApproval(
  renderedClipAssetId: string,
  decision: ContentApprovalDecision,
  comment?: string,
): Promise<void> {
  if (decision === "revision_requested" && !comment?.trim()) {
    throw new Error("Add a comment explaining what needs to change.");
  }

  const { user, brand } = await requireCapability("clip:approve_content");

  const rendered = await prisma.renderedClipAsset.findFirst({
    where: { id: renderedClipAssetId, clip: { brandId: brand.id } },
    include: { clip: true },
  });
  if (!rendered) throw new Error("Render not found.");
  if (rendered.contentApprovalStatus !== "PENDING_REVIEW") {
    throw new Error("This render isn't waiting on review anymore.");
  }

  await inngest.send({
    name: "clip/content-approval.decided",
    data: { renderedClipAssetId, decision, userId: user.id, comment: comment?.trim() || undefined },
  });

  revalidatePath("/review");
  revalidatePath(`/sources/${rendered.clip.sourceAssetId}/clips/${rendered.clipId}`);
}
