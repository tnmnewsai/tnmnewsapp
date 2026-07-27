import { prisma } from "@svt/db";
import { inngest } from "../client";

/**
 * Sweeps for ScheduledPosts whose day has arrived and kicks off the real
 * publish for each — the single source of truth for "is it time yet" is
 * this periodic check against the live `scheduledFor` column, not a
 * per-post durable sleep. That's what makes reassigning a banked clip to a
 * different calendar day (Milestone 12) just a plain DB update: the next
 * sweep picks up whatever `scheduledFor` currently says.
 */
export const checkScheduledPosts = inngest.createFunction(
  { id: "check-scheduled-posts" },
  { cron: "*/5 * * * *" },
  async ({ step }) => {
    const duePosts = await step.run("find-due-posts", async () =>
      prisma.scheduledPost.findMany({
        where: { status: "SCHEDULED", scheduledFor: { lte: new Date() } },
        select: { id: true },
      }),
    );

    for (const post of duePosts) {
      await step.sendEvent(`trigger-${post.id}`, {
        name: "scheduled-post/publish.requested",
        data: { scheduledPostId: post.id },
      });
    }
  },
);
