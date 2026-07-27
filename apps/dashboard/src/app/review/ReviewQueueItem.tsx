"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { decideContentApproval } from "./actions";
import styles from "./review.module.css";

interface ModerationDetail {
  kind: "text" | "frame";
  label: string;
  flagged: boolean;
  categories: string[];
}

export default function ReviewQueueItem({
  renderedClipAssetId,
  clipTitle,
  clipHref,
  aspectRatio,
  moderationStatus,
  moderationDetails,
  comments,
}: {
  renderedClipAssetId: string;
  clipTitle: string;
  clipHref: string;
  aspectRatio: string;
  moderationStatus: "PENDING" | "CLEAR" | "FLAGGED" | "FAILED";
  moderationDetails: unknown;
  comments: { id: string; body: string; createdAt: string }[];
}) {
  const [decided, setDecided] = useState(false);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const details = Array.isArray(moderationDetails) ? (moderationDetails as ModerationDetail[]) : [];
  const flaggedDetails = details.filter((d) => d.flagged);

  function decide(decision: "approved" | "rejected" | "revision_requested") {
    setError(null);
    startTransition(async () => {
      try {
        await decideContentApproval(renderedClipAssetId, decision, comment || undefined);
        setDecided(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });
  }

  if (decided) {
    return (
      <li className={styles.item}>
        <p>Decision recorded for &ldquo;{clipTitle}&rdquo;.</p>
      </li>
    );
  }

  return (
    <li className={styles.item}>
      <div className={styles.itemHeader}>
        <Link href={clipHref}>{clipTitle}</Link>
        <span className={styles.badge}>{aspectRatio}</span>
        <span className={moderationStatus === "FLAGGED" ? styles.badgeWarn : styles.badge}>
          moderation: {moderationStatus.toLowerCase()}
        </span>
      </div>

      <video controls className={styles.video} src={`/api/rendered-clips/${renderedClipAssetId}/video`} />

      {flaggedDetails.length > 0 && (
        <ul className={styles.flaggedList}>
          {flaggedDetails.map((d, i) => (
            <li key={i}>
              {d.kind} &ldquo;{d.label}&rdquo; flagged: {d.categories.join(", ")}
            </li>
          ))}
        </ul>
      )}

      {comments.length > 0 && (
        <div className={styles.comments}>
          <strong>Past comments</strong>
          <ul>
            {comments.map((c) => (
              <li key={c.id}>{c.body}</li>
            ))}
          </ul>
        </div>
      )}

      <textarea
        className={styles.commentBox}
        placeholder="Optional comment (required for revision requests)"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
      />

      <div className={styles.actions}>
        <button type="button" disabled={pending} onClick={() => decide("approved")}>
          Approve
        </button>
        <button type="button" disabled={pending} onClick={() => decide("revision_requested")}>
          Request revision
        </button>
        <button type="button" disabled={pending} onClick={() => decide("rejected")}>
          Reject
        </button>
      </div>

      {error && <p className={styles.error}>{error}</p>}
    </li>
  );
}
