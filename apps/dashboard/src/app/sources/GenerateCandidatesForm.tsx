"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { requestClipCandidates } from "./actions";
import styles from "./sources.module.css";

export default function GenerateCandidatesForm({ sourceAssetId }: { sourceAssetId: string }) {
  const [count, setCount] = useState(3);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function submit() {
    setError(null);
    startTransition(async () => {
      try {
        await requestClipCandidates(sourceAssetId, count);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });
  }

  return (
    <div className={styles.generateForm}>
      <label>
        Number of clips to generate
        <input
          type="number"
          min={1}
          max={10}
          value={count}
          onChange={(e) => setCount(Number(e.target.value))}
        />
      </label>
      <button type="button" onClick={submit} disabled={pending}>
        {pending ? "Requesting…" : "Generate candidates"}
      </button>
      {error && <p className={styles.error}>{error}</p>}
    </div>
  );
}
