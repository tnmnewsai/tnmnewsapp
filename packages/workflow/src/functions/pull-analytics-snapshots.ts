import { prisma, Prisma } from "@svt/db";
import type { Platform, PlatformAdapter } from "@svt/publishing-core";
import { youtubeAdapter } from "@svt/publishing-youtube";
import { metaAdapter } from "@svt/publishing-meta";
import { tiktokAdapter } from "@svt/publishing-tiktok";
import { xAdapter } from "@svt/publishing-x";
import { resolveAccessToken } from "../lib/resolve-access-token";
import { inngest } from "../client";

const ADAPTERS: Partial<Record<Platform, PlatformAdapter>> = {
  YOUTUBE: youtubeAdapter,
  META: metaAdapter,
  TIKTOK: tiktokAdapter,
  X: xAdapter,
};

const WEEKLY_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Sweeps for due AnalyticsSnapshot pulls (1h/24h/7d, then a self-perpetuating
 * weekly chain — each captured WEEKLY snapshot creates the next one) and
 * fetches fresh metrics for each from the platform's real API. Same
 * cron-sweep shape as `check-scheduled-posts`, just on a longer interval
 * since analytics don't need near-real-time precision.
 */
export const pullAnalyticsSnapshots = inngest.createFunction(
  { id: "pull-analytics-snapshots" },
  { cron: "*/30 * * * *" },
  async ({ step }) => {
    const dueSnapshots = await step.run("find-due-snapshots", async () =>
      prisma.analyticsSnapshot.findMany({
        where: { status: "PENDING", dueAt: { lte: new Date() } },
        include: {
          platformPostResult: {
            include: {
              publishingPackage: { include: { platformAccount: { include: { brand: true } } } },
            },
          },
        },
      }),
    );

    for (const snapshot of dueSnapshots) {
      await step.run(`pull-${snapshot.id}`, async () => {
        const { platformPostResult } = snapshot;
        const account = platformPostResult.publishingPackage.platformAccount;
        const platform = platformPostResult.platform;
        const platformPostId = platformPostResult.platformPostId;

        if (!account || !platformPostId) {
          await prisma.analyticsSnapshot.update({
            where: { id: snapshot.id },
            data: { status: "FAILED", errorMessage: "No connected account or post id to pull analytics for." },
          });
          return;
        }

        const adapter = ADAPTERS[platform as Platform];
        if (!adapter) {
          await prisma.analyticsSnapshot.update({
            where: { id: snapshot.id },
            data: { status: "FAILED", errorMessage: `No adapter implemented for platform ${platform}.` },
          });
          return;
        }

        try {
          const accessToken = await resolveAccessToken(adapter, account, account.brand.accountId);
          const metrics = await adapter.getAnalytics({
            account: { externalAccountId: account.externalAccountId, accessToken },
            platformPostId,
          });

          const capturedAt = new Date();
          await prisma.$transaction(async (tx) => {
            await tx.analyticsSnapshot.update({
              where: { id: snapshot.id },
              data: {
                status: "SUCCESS",
                capturedAt,
                views: metrics.views,
                likes: metrics.likes,
                comments: metrics.comments,
                shares: metrics.shares,
                rawMetrics: (metrics.raw ?? null) as Prisma.InputJsonValue,
              },
            });

            // The weekly chain starts once the 7d pull lands, and each
            // captured weekly snapshot extends the chain by one more week.
            if (snapshot.interval === "PLUS_7D" || snapshot.interval === "WEEKLY") {
              await tx.analyticsSnapshot.create({
                data: {
                  platformPostResultId: snapshot.platformPostResultId,
                  interval: "WEEKLY",
                  dueAt: new Date(capturedAt.getTime() + WEEKLY_INTERVAL_MS),
                },
              });
            }
          });
        } catch (err) {
          await prisma.analyticsSnapshot.update({
            where: { id: snapshot.id },
            data: { status: "FAILED", errorMessage: String(err) },
          });
        }
      });
    }
  },
);
