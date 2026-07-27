"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { requestPostCopyVariants } from "./actions";
import styles from "./sources.module.css";

export interface PostCopyVariantView {
  id: string;
  text: string;
  hashtags: string[];
  status: "DRAFT" | "APPROVED" | "REJECTED";
}

export default function PostCopySection({
  clipId,
  publishingApprovalStatus,
  batchInProgress,
  batchError,
  variants,
  comments,
}: {
  clipId: string;
  publishingApprovalStatus: "NOT_APPLICABLE" | "PENDING_REVIEW" | "APPROVED" | "REJECTED" | "REVISION_REQUESTED";
  batchInProgress: boolean;
  batchError: string | null;
  variants: PostCopyVariantView[];
  comments: { id: string; body: string }[];
}) {
  const [targetCount, setTargetCount] = useState(3);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function generate() {
    setError(null);
    startTransition(async () => {
      try {
        await requestPostCopyVariants(clipId, targetCount);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });
  }

  const nonRejected = variants.filter((v) => v.status !== "REJECTED");

  return (
    <div className={styles.brandingSection}>
      <p>
        {publishingApprovalStatus !== "NOT_APPLICABLE" && (
          <span className={styles.badge}>publishing: {publishingApprovalStatus.toLowerCase()}</span>
        )}
      </p>

      <div className={styles.generateForm}>
        <label>
          Variants
          <input
            type="number"
            min={1}
            max={8}
            value={targetCount}
            onChange={(e) => setTargetCount(Number(e.target.value))}
          />
        </label>
        <button type="button" onClick={generate} disabled={pending || batchInProgress}>
          {batchInProgress ? "Generating…" : "Generate copy variants"}
        </button>
      </div>

      {batchError && <p className={styles.error}>{batchError}</p>}
      {error && <p className={styles.error}>{error}</p>}

      {nonRejected.length > 0 && (
        <ul className={styles.overlayList}>
          {nonRejected.map((v) => (
            <li key={v.id}>
              <span>
                {v.text}
                {v.hashtags.length > 0 && (
                  <span style={{ color: "#62667a" }}> {v.hashtags.map((h) => `#${h}`).join(" ")}</span>
                )}{" "}
                <span className={styles.badge}>{v.status}</span>
              </span>
            </li>
          ))}
        </ul>
      )}

      {comments.length > 0 && (
        <ul className={styles.overlayList}>
          {comments.map((c) => (
            <li key={c.id}>{c.body}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
