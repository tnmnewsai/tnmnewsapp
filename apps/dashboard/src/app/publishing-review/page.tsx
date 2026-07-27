import Link from "next/link";
import { prisma } from "@svt/db";
import { requireCurrentBrand } from "@/lib/current-brand";
import PublishingQueueItem from "./PublishingQueueItem";
import styles from "./publishing-review.module.css";

export default async function PublishingReviewPage() {
  const brand = await requireCurrentBrand();

  const [pending, recentlyDecided] = await Promise.all([
    prisma.clip.findMany({
      where: { brandId: brand.id, publishingApprovalStatus: "PENDING_REVIEW" },
      include: { postCopies: { where: { status: "DRAFT" }, orderBy: { createdAt: "asc" } } },
      orderBy: { updatedAt: "asc" },
    }),
    prisma.clip.findMany({
      where: {
        brandId: brand.id,
        publishingApprovalStatus: { in: ["APPROVED", "REJECTED", "REVISION_REQUESTED"] },
      },
      orderBy: { updatedAt: "desc" },
      take: 10,
    }),
  ]);

  const commentTargetIds = pending.map((c) => c.id);
  const comments = commentTargetIds.length
    ? await prisma.reviewComment.findMany({
        where: { targetType: "CLIP", targetId: { in: commentTargetIds } },
        orderBy: { createdAt: "desc" },
      })
    : [];
  const commentsByClip = new Map<string, typeof comments>();
  for (const c of comments) {
    commentsByClip.set(c.targetId, [...(commentsByClip.get(c.targetId) ?? []), c]);
  }

  return (
    <main className={styles.page}>
      <div className={styles.header}>
        <h1>Publishing review queue</h1>
        <Link href="/sources">Back to sources</Link>
      </div>

      <p className={styles.help}>
        Gate 2 — pick one copy variant to approve for publishing, or send the batch back with a comment.
        Approved clips bank in a queue here, decoupled from scheduling.
      </p>

      {pending.length === 0 ? (
        <p>Nothing waiting on publishing review.</p>
      ) : (
        <ul className={styles.queue}>
          {pending.map((clip) => (
            <PublishingQueueItem
              key={clip.id}
              clipId={clip.id}
              clipTitle={clip.title}
              clipHref={`/sources/${clip.sourceAssetId}/clips/${clip.id}`}
              variants={clip.postCopies.map((p) => ({
                id: p.id,
                text: p.text,
                hashtags: Array.isArray(p.hashtags) ? (p.hashtags as string[]) : [],
              }))}
              comments={(commentsByClip.get(clip.id) ?? []).map((c) => ({ id: c.id, body: c.body }))}
            />
          ))}
        </ul>
      )}

      {recentlyDecided.length > 0 && (
        <>
          <h2>Recently decided</h2>
          <ul className={styles.recentList}>
            {recentlyDecided.map((clip) => (
              <li key={clip.id}>
                <Link href={`/sources/${clip.sourceAssetId}/clips/${clip.id}`}>{clip.title}</Link>{" "}
                <span className={styles.badge}>{clip.publishingApprovalStatus}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}
