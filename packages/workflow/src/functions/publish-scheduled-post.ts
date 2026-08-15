import { prisma, Prisma } from "@svt/db";
import { getStorage } from "@svt/storage";
import type { Platform, PlatformAdapter } from "@svt/publishing-core";
import { youtubeAdapter } from "@svt/publishing-youtube";
import { facebookAdapter, metaAdapter } from "@svt/publishing-meta";
import { tiktokAdapter } from "@svt/publishing-tiktok";
import { xAdapter } from "@svt/publishing-x";
import { inngest } from "../client";
import { resolveAccessToken } from "../lib/resolve-access-token";

export interface PublishScheduledPostRequestedEvent {
  name: "scheduled-post/publish.requested";
  data: { scheduledPostId: string };
}

/** All five target platforms now have real adapters. */
const ADAPTERS: Partial<Record<Platform, PlatformAdapter>> = {
  YOUTUBE: youtubeAdapter,
  META: metaAdapter,
  FACEBOOK: facebookAdapter,
  TIKTOK: tiktokAdapter,
  X: xAdapter,
};

interface PublishOutcome {
  status: "SUCCESS" | "FAILED";
  platformPostId?: string;
  platformUrl?: string;
  errorMessage?: string;
}

interface PackageForPublish {
  id: string;
  platform: string;
  title: string;
  description: string;
  tags: Prisma.JsonValue;
  platformAccount: {
    id: string;
    externalAccountId: string;
    accessTokenEnc: string;
    refreshTokenEnc: string | null;
    tokenExpiresAt: Date | string | null;
    brand: { accountId: string };
  } | null;
  renderedClipAsset: { storageKey: string | null };
  thumbnailAsset: { storageKey: string | null } | null;
}

async function publishOnePackage(pkg: PackageForPublish): Promise<PublishOutcome> {
  const adapter = ADAPTERS[pkg.platform as Platform];
  if (!adapter) {
    return { status: "FAILED", errorMessage: `No adapter implemented for platform ${pkg.platform}.` };
  }

  const account = pkg.platformAccount;
  if (!account) return { status: "FAILED", errorMessage: "Package has no connected platform account." };

  try {
    const accessToken = await resolveAccessToken(adapter, account, account.brand.accountId);

    const storageKey = pkg.renderedClipAsset.storageKey;
    if (!storageKey) throw new Error("Rendered clip has no stored video.");

    const content = {
      title: pkg.title,
      description: pkg.description,
      tags: Array.isArray(pkg.tags) ? (pkg.tags as string[]) : [],
    };

    // Resolved once regardless of platform — YouTube's adapter ignores it
    // (direct upload), Meta's requires it (fetches by reference) and fails
    // clearly if it's null (local storage can't produce a public URL).
    const videoPublicUrl = (await getStorage().getPublicUrl(storageKey)) ?? undefined;

    const result = await getStorage().withLocalFile(storageKey, async (videoPath) => {
      if (pkg.thumbnailAsset?.storageKey) {
        return getStorage().withLocalFile(pkg.thumbnailAsset.storageKey, (thumbPath) =>
          adapter.publish({
            account: { externalAccountId: account.externalAccountId, accessToken },
            videoLocalPath: videoPath,
            videoPublicUrl,
            thumbnailLocalPath: thumbPath,
            content,
          }),
        );
      }
      return adapter.publish({
        account: { externalAccountId: account.externalAccountId, accessToken },
        videoLocalPath: videoPath,
        videoPublicUrl,
        content,
      });
    });

    return { status: "SUCCESS", platformPostId: result.platformPostId, platformUrl: result.platformUrl };
  } catch (err) {
    return { status: "FAILED", errorMessage: String(err) };
  }
}

/**
 * Publishes every connected-platform package for one ScheduledPost and
 * records the outcome. Triggered by `check-scheduled-posts`' cron sweep
 * once the post is actually due — not a per-post `step.sleepUntil` — so
 * reassigning a clip to a different calendar day (Milestone 12) is just a
 * plain `scheduledFor` update picked up on the next sweep, not something
 * that has to fight an already-sleeping workflow instance. Manual-fallback
 * packages (no connected account) were already finalized at
 * schedule-creation time — this function only ever touches PENDING ones.
 */
export const publishScheduledPost = inngest.createFunction(
  { id: "publish-scheduled-post", retries: 1 },
  { event: "scheduled-post/publish.requested" },
  async ({ event, step }) => {
    const { scheduledPostId } = event.data as PublishScheduledPostRequestedEvent["data"];

    const scheduledPost = await step.run("load", async () =>
      prisma.scheduledPost.findUniqueOrThrow({ where: { id: scheduledPostId } }),
    );

    // Guards against duplicate triggers (e.g. a slow cron sweep overlapping
    // with a manual retry) re-publishing something already in flight or done.
    if (scheduledPost.status !== "SCHEDULED") return;

    await step.run("mark-publishing", async () => {
      await prisma.scheduledPost.update({ where: { id: scheduledPostId }, data: { status: "PUBLISHING" } });
    });

    const packages = await step.run("load-packages", async () =>
      prisma.publishingPackage.findMany({
        where: { scheduledPostId, status: "PENDING" },
        include: {
          platformAccount: { include: { brand: true } },
          renderedClipAsset: true,
          thumbnailAsset: true,
        },
      }),
    );

    for (const pkg of packages) {
      const outcome = await step.run(`publish-${pkg.id}`, () => publishOnePackage(pkg));

      await step.run(`record-${pkg.id}`, async () => {
        await prisma.$transaction(async (tx) => {
          await tx.publishingPackage.update({
            where: { id: pkg.id },
            data: {
              status: outcome.status === "SUCCESS" ? "PUBLISHED" : "FAILED",
              errorMessage: outcome.errorMessage,
            },
          });

          const publishedAt = outcome.status === "SUCCESS" ? new Date() : null;
          const result = await tx.platformPostResult.upsert({
            where: { publishingPackageId: pkg.id },
            create: {
              publishingPackageId: pkg.id,
              platform: pkg.platform,
              status: outcome.status,
              platformPostId: outcome.platformPostId,
              platformUrl: outcome.platformUrl,
              errorMessage: outcome.errorMessage,
              publishedAt,
            },
            update: {
              status: outcome.status,
              platformPostId: outcome.platformPostId,
              platformUrl: outcome.platformUrl,
              errorMessage: outcome.errorMessage,
              publishedAt,
            },
          });

          // Seed the 1h/24h/7d analytics pulls — the weekly chain (recurring
          // indefinitely) is seeded later, once the 7d pull actually lands.
          if (outcome.status === "SUCCESS" && publishedAt) {
            const existing = await tx.analyticsSnapshot.count({ where: { platformPostResultId: result.id } });
            if (existing === 0) {
              await tx.analyticsSnapshot.createMany({
                data: [
                  {
                    platformPostResultId: result.id,
                    interval: "PLUS_1H",
                    dueAt: new Date(publishedAt.getTime() + 60 * 60 * 1000),
                  },
                  {
                    platformPostResultId: result.id,
                    interval: "PLUS_24H",
                    dueAt: new Date(publishedAt.getTime() + 24 * 60 * 60 * 1000),
                  },
                  {
                    platformPostResultId: result.id,
                    interval: "PLUS_7D",
                    dueAt: new Date(publishedAt.getTime() + 7 * 24 * 60 * 60 * 1000),
                  },
                ],
              });
            }
          }
        });
      });
    }

    await step.run("finalize", async () => {
      const allPackages = await prisma.publishingPackage.findMany({ where: { scheduledPostId } });
      // Manual-fallback packages are an accepted, intentional outcome, not a
      // failure of this workflow — only automated (connected-account)
      // packages count toward PUBLISHED/PARTIALLY_PUBLISHED/FAILED.
      const automated = allPackages.filter((p) => p.status !== "MANUAL_FALLBACK");
      const anySuccess = automated.some((p) => p.status === "PUBLISHED");
      const anyFailed = automated.some((p) => p.status === "FAILED");

      let status: "PUBLISHED" | "PARTIALLY_PUBLISHED" | "FAILED";
      if (automated.length === 0 || (anySuccess && !anyFailed)) {
        status = "PUBLISHED";
      } else if (anySuccess && anyFailed) {
        status = "PARTIALLY_PUBLISHED";
      } else {
        status = "FAILED";
      }

      await prisma.scheduledPost.update({ where: { id: scheduledPostId }, data: { status } });
    });
  },
);
