"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { decidePublishingApproval } from "./actions";
import styles from "./publishing-review.module.css";

interface Variant {
  id: string;
  text: string;
  hashtags: string[];
}

export default function PublishingQueueItem({
  clipId,
  clipTitle,
  clipHref,
  variants,
  comments,
}: {
  clipId: string;
  clipTitle: string;
  clipHref: string;
  variants: Variant[];
  comments: { id: string; body: string }[];
}) {
  const [selectedId, setSelectedId] = useState(variants[0]?.id ?? "");
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [decided, setDecided] = useState(false);
  const [pending, startTransition] = useTransition();

  function decide(decision: "approved" | "rejected" | "revision_requested") {
    setError(null);
    startTransition(async () => {
      try {
        await decidePublishingApproval(clipId, decision, {
          selectedPostCopyId: decision === "approved" ? selectedId : undefined,
          comment: comment || undefined,
        });
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

  if (variants.length === 0) {
    return (
      <li className={styles.item}>
        <div className={styles.itemHeader}>
          <Link href={clipHref}>{clipTitle}</Link>
        </div>
        <p className={styles.help}>No draft variants — generate copy on the clip page first.</p>
      </li>
    );
  }

  return (
    <li className={styles.item}>
      <div className={styles.itemHeader}>
        <Link href={clipHref}>{clipTitle}</Link>
      </div>

      <ul className={styles.variantList}>
        {variants.map((v) => (
          <li key={v.id} className={styles.variantCard}>
            <label>
              <input
                type="radio"
                name={`variant-${clipId}`}
                checked={selectedId === v.id}
                onChange={() => setSelectedId(v.id)}
              />
              <span>{v.text}</span>
            </label>
            {v.hashtags.length > 0 && (
              <p className={styles.hashtags}>{v.hashtags.map((h) => `#${h}`).join(" ")}</p>
            )}
          </li>
        ))}
      </ul>

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
          Approve selected
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
