"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { acceptClipCandidate, rejectClipCandidate } from "./actions";
import styles from "./sources.module.css";

function formatMs(ms: number): string {
  const totalSeconds = ms / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = (totalSeconds % 60).toFixed(1);
  return `${minutes}:${seconds.padStart(4, "0")}`;
}

export default function CandidateCard({
  sourceAssetId,
  candidate,
}: {
  sourceAssetId: string;
  candidate: {
    id: string;
    title: string;
    rationale: string;
    confidence: number;
    startMs: number;
    endMs: number;
  };
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function accept() {
    setError(null);
    startTransition(async () => {
      try {
        const clipId = await acceptClipCandidate(candidate.id);
        router.push(`/sources/${sourceAssetId}/clips/${clipId}`);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });
  }

  function reject() {
    setError(null);
    startTransition(async () => {
      try {
        await rejectClipCandidate(candidate.id);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });
  }

  return (
    <li className={styles.candidateCard}>
      <div className={styles.candidateHeader}>
        <strong>{candidate.title}</strong>
        <span className={styles.badge}>{Math.round(candidate.confidence * 100)}% confidence</span>
      </div>
      <p className={styles.candidateRationale}>{candidate.rationale}</p>
      <p className={styles.candidateRange}>
        {formatMs(candidate.startMs)} – {formatMs(candidate.endMs)}
      </p>
      {error && <p className={styles.error}>{error}</p>}
      <div className={styles.formActions}>
        <button type="button" onClick={accept} disabled={pending}>
          Accept
        </button>
        <button type="button" onClick={reject} disabled={pending}>
          Reject
        </button>
      </div>
    </li>
  );
}
