import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@svt/db";
import { requireCurrentBrand } from "@/lib/current-brand";
import EditClipSection from "../../../EditClipSection";
import RenderSection from "../../../RenderSection";
import BrandingSection from "../../../BrandingSection";
import ThumbnailSection from "../../../ThumbnailSection";
import PostCopySection from "../../../PostCopySection";
import ScheduleSection from "../../../ScheduleSection";
import AnalyticsSection from "../../../AnalyticsSection";
import AutoRefresh from "../../../AutoRefresh";
import styles from "../../../sources.module.css";
import type { ClipEditState } from "@svt/workflow/client";

export default async function ClipPage({
  params,
}: {
  params: Promise<{ id: string; clipId: string }>;
}) {
  const { id, clipId } = await params;
  const brand = await requireCurrentBrand();

  const [clip, brandTemplates, musicTracks, graphicAssets, connectedAccounts] = await Promise.all([
    prisma.clip.findFirst({
      where: { id: clipId, sourceAssetId: id, brandId: brand.id },
      include: {
        renderedAssets: { orderBy: { createdAt: "desc" } },
        thumbnailAssets: { orderBy: { createdAt: "desc" } },
        postCopies: { orderBy: { createdAt: "desc" } },
        postCopyBatches: { orderBy: { createdAt: "desc" }, take: 1 },
        scheduledPosts: {
          orderBy: { createdAt: "desc" },
          include: {
            publishingPackages: {
              include: {
                platformPostResult: { include: { analyticsSnapshots: { orderBy: { dueAt: "asc" } } } },
              },
              orderBy: { platform: "asc" },
            },
          },
        },
      },
    }),
    prisma.brandTemplate.findMany({ where: { brandId: brand.id }, orderBy: { version: "desc" } }),
    prisma.musicTrack.findMany({ where: { brandId: brand.id }, orderBy: { createdAt: "desc" } }),
    prisma.graphicAsset.findMany({ where: { brandId: brand.id }, orderBy: { createdAt: "desc" } }),
    prisma.platformAccount.findMany({ where: { brandId: brand.id, status: "CONNECTED" } }),
  ]);

  if (!clip) notFound();

  const editState = clip.editState as unknown as ClipEditState;
  const segment = editState.segments[0] ?? { startMs: 0, endMs: 5000 };
  const clipDurationSec = (segment.endMs - segment.startMs) / 1000;

  const latestOriginalRender = clip.renderedAssets.find((r) => r.aspectRatio === "original") ?? null;
  const latestBrandedRender = clip.renderedAssets.find((r) => r.aspectRatio === "9:16") ?? null;
  const anyRenderInProgress = clip.renderedAssets.some(
    (r) => r.status === "PENDING" || r.status === "RENDERING",
  );
  const anyThumbnailInProgress = clip.thumbnailAssets.some(
    (t) => t.status === "PENDING" || t.status === "RENDERING",
  );

  const readyBrandedRenders = clip.renderedAssets.filter(
    (r) => r.status === "READY" && r.aspectRatio !== "original",
  );

  const renderCommentTargetIds = clip.renderedAssets.map((r) => r.id);
  const renderComments = renderCommentTargetIds.length
    ? await prisma.reviewComment.findMany({
        where: { targetType: "RENDERED_CLIP_ASSET", targetId: { in: renderCommentTargetIds } },
        orderBy: { createdAt: "desc" },
      })
    : [];
  const commentsByRender = new Map<string, { id: string; body: string }[]>();
  for (const c of renderComments) {
    commentsByRender.set(c.targetId, [...(commentsByRender.get(c.targetId) ?? []), { id: c.id, body: c.body }]);
  }

  const clipComments = await prisma.reviewComment.findMany({
    where: { targetType: "CLIP", targetId: clip.id },
    orderBy: { createdAt: "desc" },
  });

  const latestPostCopyBatch = clip.postCopyBatches[0];
  const postCopyBatchInProgress =
    latestPostCopyBatch &&
    (latestPostCopyBatch.status === "PENDING" || latestPostCopyBatch.status === "PROCESSING");

  return (
    <main className={styles.page}>
      {(anyRenderInProgress || anyThumbnailInProgress || postCopyBatchInProgress) && <AutoRefresh />}

      <div className={styles.header}>
        <h1>{clip.title}</h1>
        <Link href={`/sources/${id}`}>Back to source</Link>
      </div>

      <EditClipSection
        clipId={clip.id}
        sourceAssetId={id}
        videoSrc={`/api/source-assets/${id}/video`}
        initialTitle={clip.title}
        initialStartMs={segment.startMs}
        initialEndMs={segment.endMs}
      />

      <h2>Branding</h2>
      <BrandingSection
        clipId={clip.id}
        initialOverlays={editState.overlays ?? []}
        initialMusicTrackId={editState.musicTrackId}
        initialMusicVolume={editState.musicVolume}
        initialBrandTemplateId={editState.brandTemplateId}
        graphicAssets={graphicAssets.map((g) => ({ id: g.id, name: g.name }))}
        musicTracks={musicTracks.map((m) => ({ id: m.id, name: m.name }))}
        brandTemplates={brandTemplates.map((t) => ({ id: t.id, name: t.name, version: t.version }))}
      />

      <h2>Render</h2>
      <RenderSection
        clipId={clip.id}
        aspectRatio="original"
        label="plain cut"
        latestRender={latestOriginalRender}
        comments={latestOriginalRender ? commentsByRender.get(latestOriginalRender.id) ?? [] : []}
      />
      <RenderSection
        clipId={clip.id}
        aspectRatio="9:16"
        label="branded 9:16"
        latestRender={latestBrandedRender}
        comments={latestBrandedRender ? commentsByRender.get(latestBrandedRender.id) ?? [] : []}
      />

      <h2>Thumbnail (cover image)</h2>
      <ThumbnailSection
        clipId={clip.id}
        clipDurationSec={clipDurationSec}
        renderOptions={readyBrandedRenders.map((r) => ({ id: r.id, aspectRatio: r.aspectRatio }))}
        graphicOptions={graphicAssets.map((g) => ({ id: g.id, name: g.name }))}
        thumbnails={clip.thumbnailAssets.map((t) => ({
          id: t.id,
          titleText: t.titleText,
          descriptionText: t.descriptionText,
          status: t.status,
          errorMessage: t.errorMessage,
        }))}
      />

      <h2>Post copy</h2>
      <PostCopySection
        clipId={clip.id}
        publishingApprovalStatus={clip.publishingApprovalStatus}
        batchInProgress={Boolean(postCopyBatchInProgress)}
        batchError={latestPostCopyBatch?.status === "FAILED" ? latestPostCopyBatch.errorMessage : null}
        variants={clip.postCopies.map((p) => ({
          id: p.id,
          text: p.text,
          hashtags: Array.isArray(p.hashtags) ? (p.hashtags as string[]) : [],
          status: p.status,
        }))}
        comments={clipComments.map((c) => ({ id: c.id, body: c.body }))}
      />

      <h2>Schedule</h2>
      <ScheduleSection
        clipId={clip.id}
        canSchedule={clip.publishingApprovalStatus === "APPROVED"}
        connectedPlatforms={connectedAccounts.map((a) => a.platform)}
        scheduledPosts={clip.scheduledPosts.map((sp) => ({
          id: sp.id,
          scheduledFor: sp.scheduledFor.toISOString(),
          status: sp.status,
          packages: sp.publishingPackages.map((pkg) => ({
            id: pkg.id,
            platform: pkg.platform,
            status: pkg.status,
            title: pkg.title,
            description: pkg.description,
            tags: Array.isArray(pkg.tags) ? (pkg.tags as string[]) : [],
            hasVideo: true,
            hasThumbnail: Boolean(pkg.thumbnailAssetId),
            errorMessage: pkg.errorMessage,
            platformUrl: pkg.platformPostResult?.platformUrl ?? null,
          })),
        }))}
      />

      <h2>Analytics</h2>
      <AnalyticsSection
        results={clip.scheduledPosts
          .flatMap((sp) => sp.publishingPackages)
          .filter((pkg) => pkg.platformPostResult && pkg.platformPostResult.status === "SUCCESS")
          .map((pkg) => {
            const result = pkg.platformPostResult!;
            return {
              id: result.id,
              platform: pkg.platform,
              platformUrl: result.platformUrl,
              publishedAt: result.publishedAt?.toISOString() ?? null,
              snapshots: result.analyticsSnapshots.map((s) => ({
                id: s.id,
                interval: s.interval,
                dueAt: s.dueAt.toISOString(),
                capturedAt: s.capturedAt?.toISOString() ?? null,
                status: s.status,
                views: s.views,
                likes: s.likes,
                comments: s.comments,
                shares: s.shares,
                errorMessage: s.errorMessage,
              })),
            };
          })}
      />
    </main>
  );
}
