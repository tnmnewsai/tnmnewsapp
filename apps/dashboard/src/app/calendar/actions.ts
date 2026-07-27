"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@svt/db";
import { requireCapability } from "@/lib/current-brand";
import { dayBoundsUTC } from "@/lib/schedule-day";

/**
 * Only SCHEDULED posts can move or be cancelled — once PUBLISHING has
 * started (picked up by the cron sweep), the workflow is already executing
 * and neither operation would be safe or meaningful anymore.
 */
export async function reassignScheduledPost(scheduledPostId: string, newScheduledFor: string): Promise<void> {
  const { brand } = await requireCapability("schedule:manage");

  const post = await prisma.scheduledPost.findFirst({ where: { id: scheduledPostId, brandId: brand.id } });
  if (!post) throw new Error("Scheduled post not found.");
  if (post.status !== "SCHEDULED") throw new Error("Only posts still waiting to publish can be reassigned.");

  const newDate = new Date(newScheduledFor);
  if (Number.isNaN(newDate.getTime())) throw new Error("Invalid date.");

  const { start, end } = dayBoundsUTC(newDate);
  const collision = await prisma.scheduledPost.findFirst({
    where: { brandId: brand.id, scheduledFor: { gte: start, lt: end }, id: { not: scheduledPostId } },
  });
  if (collision) throw new Error("This brand already has a clip scheduled for that day.");

  await prisma.scheduledPost.update({ where: { id: scheduledPostId }, data: { scheduledFor: newDate } });

  revalidatePath("/calendar");
}

export async function cancelScheduledPost(scheduledPostId: string): Promise<void> {
  const { brand } = await requireCapability("schedule:manage");

  const post = await prisma.scheduledPost.findFirst({ where: { id: scheduledPostId, brandId: brand.id } });
  if (!post) throw new Error("Scheduled post not found.");
  if (post.status !== "SCHEDULED") throw new Error("Only posts still waiting to publish can be cancelled.");

  // Cascades to PublishingPackage → PlatformPostResult — nothing external
  // happened yet, so there's nothing to undo besides these rows.
  await prisma.scheduledPost.delete({ where: { id: scheduledPostId } });

  revalidatePath("/calendar");
}
