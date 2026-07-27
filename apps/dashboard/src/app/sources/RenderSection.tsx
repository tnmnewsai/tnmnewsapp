"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { requestClipRender } from "./actions";
import styles from "./sources.module.css";

interface RenderedClipAsset {
  id: string;
  status: "PENDING" | "RENDERING" | "READY" | "FAILED";
  errorMessage: string | null;
  contentApprovalStatus?: "NOT_APPLICABLE" | "PENDING_REVIEW" | "APPROVED" | "REJECTED" | "REVISION_REQUESTED";
  moderationStatus?: "PENDING" | "CLEAR" | "FLAGGED" | "FAILED";
}

export default function RenderSection({
  clipId,
  aspectRatio,
  label,
  latestRender,
  comments = [],
}: {
  clipId: string;
  aspectRatio: string;
  label: string;
  latestRender: RenderedClipAsset | null;
  comments?: { id: string; body: string }[];
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function render() {
    setError(null);
    startTransition(async () => {
      try {
        await requestClipRender(clipId, aspectRatio);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });
  }

  return (
    <div className={styles.renderSection}>
      <button type="button" onClick={render} disabled={pending}>
        {pending ? "Requesting…" : latestRender ? `Re-render (${label})` : `Render (${label})`}
      </button>

      {latestRender && <span className={styles.badge}>render: {latestRender.status}</span>}
      {latestRender?.contentApprovalStatus && latestRender.contentApprovalStatus !== "NOT_APPLICABLE" && (
        <span className={styles.badge}>approval: {latestRender.contentApprovalStatus.toLowerCase()}</span>
      )}
      {latestRender?.moderationStatus && latestRender.moderationStatus !== "PENDING" && (
        <span className={styles.badge}>moderation: {latestRender.moderationStatus.toLowerCase()}</span>
      )}

      {latestRender?.status === "FAILED" && latestRender.errorMessage && (
        <p className={styles.error}>{latestRender.errorMessage}</p>
      )}

      {latestRender?.status === "READY" && (
        <video controls className={styles.video} src={`/api/rendered-clips/${latestRender.id}/video`} />
      )}

      {comments.length > 0 && (
        <ul className={styles.overlayList}>
          {comments.map((c) => (
            <li key={c.id}>{c.body}</li>
          ))}
        </ul>
      )}

      {error && <p className={styles.error}>{error}</p>}
    </div>
  );
}
