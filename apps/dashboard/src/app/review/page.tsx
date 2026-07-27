import Link from "next/link";
import { prisma } from "@svt/db";
import { requireCurrentBrand } from "@/lib/current-brand";
import ReviewQueueItem from "./ReviewQueueItem";
import styles from "./review.module.css";

export default async function ReviewPage() {
  const brand = await requireCurrentBrand();

  const [pending, recentlyDecided] = await Promise.all([
    prisma.renderedClipAsset.findMany({
      where: { clip: { brandId: brand.id }, contentApprovalStatus: "PENDING_REVIEW" },
      include: { clip: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.renderedClipAsset.findMany({
      where: {
        clip: { brandId: brand.id },
        contentApprovalStatus: { in: ["APPROVED", "REJECTED", "REVISION_REQUESTED"] },
      },
      include: { clip: true },
      orderBy: { updatedAt: "desc" },
      take: 10,
    }),
  ]);

  const commentTargetIds = [...pending, ...recentlyDecided].map((r) => r.id);
  const comments = commentTargetIds.length
    ? await prisma.reviewComment.findMany({
        where: { targetType: "RENDERED_CLIP_ASSET", targetId: { in: commentTargetIds } },
        orderBy: { createdAt: "desc" },
      })
    : [];
  const commentsByTarget = new Map<string, typeof comments>();
  for (const c of comments) {
    commentsByTarget.set(c.targetId, [...(commentsByTarget.get(c.targetId) ?? []), c]);
  }

  return (
    <main className={styles.page}>
      <div className={styles.header}>
        <h1>Content review queue</h1>
        <Link href="/sources">Back to sources</Link>
      </div>

      <p className={styles.help}>
        Gate 1 — every branded render lands here with an automated moderation result. Approve, reject, or
        request a revision with a comment.
      </p>

      {pending.length === 0 ? (
        <p>Nothing waiting on review.</p>
      ) : (
        <ul className={styles.queue}>
          {pending.map((r) => (
            <ReviewQueueItem
              key={r.id}
              renderedClipAssetId={r.id}
              clipTitle={r.clip.title}
              clipHref={`/sources/${r.clip.sourceAssetId}/clips/${r.clipId}`}
              aspectRatio={r.aspectRatio}
              moderationStatus={r.moderationStatus}
              moderationDetails={r.moderationDetails as unknown}
              comments={(commentsByTarget.get(r.id) ?? []).map((c) => ({ id: c.id, body: c.body, createdAt: c.createdAt.toISOString() }))}
            />
          ))}
        </ul>
      )}

      {recentlyDecided.length > 0 && (
        <>
          <h2>Recently decided</h2>
          <ul className={styles.recentList}>
            {recentlyDecided.map((r) => (
              <li key={r.id}>
                <Link href={`/sources/${r.clip.sourceAssetId}/clips/${r.clipId}`}>{r.clip.title}</Link>{" "}
                <span className={styles.badge}>{r.contentApprovalStatus}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}
