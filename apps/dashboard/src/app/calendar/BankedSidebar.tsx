"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { scheduleClipForPublishing } from "../sources/actions";
import styles from "./calendar.module.css";

const ALL_PLATFORMS = ["YOUTUBE", "META", "FACEBOOK", "TIKTOK", "X"] as const;

export default function BankedSidebar({
  clips,
}: {
  clips: { id: string; title: string; clipHref: string }[];
}) {
  const [dates, setDates] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function schedule(clipId: string) {
    const date = dates[clipId];
    if (!date) {
      setErrors((prev) => ({ ...prev, [clipId]: "Pick a date first." }));
      return;
    }
    setErrors((prev) => ({ ...prev, [clipId]: "" }));
    startTransition(async () => {
      try {
        await scheduleClipForPublishing(clipId, {
          scheduledFor: new Date(date).toISOString(),
          platforms: [...ALL_PLATFORMS],
        });
        router.refresh();
      } catch (e) {
        setErrors((prev) => ({ ...prev, [clipId]: e instanceof Error ? e.message : String(e) }));
      }
    });
  }

  return (
    <div className={styles.sidebar}>
      <h2>Banked (approved, unscheduled)</h2>
      {clips.length === 0 ? (
        <p className={styles.empty}>Nothing waiting — clips that pass Gate 2 show up here.</p>
      ) : (
        <ul className={styles.bankedList}>
          {clips.map((c) => (
            <li key={c.id}>
              <Link href={c.clipHref}>{c.title}</Link>
              <div className={styles.bankedActions}>
                <input
                  type="date"
                  value={dates[c.id] ?? ""}
                  onChange={(e) => setDates((prev) => ({ ...prev, [c.id]: e.target.value }))}
                />
                <button type="button" onClick={() => schedule(c.id)} disabled={pending}>
                  Schedule
                </button>
              </div>
              {errors[c.id] && <p className={styles.error}>{errors[c.id]}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
