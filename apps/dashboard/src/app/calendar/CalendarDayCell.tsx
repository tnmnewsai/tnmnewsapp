"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cancelScheduledPost, reassignScheduledPost } from "./actions";
import styles from "./calendar.module.css";

interface ScheduledPostView {
  id: string;
  status: "SCHEDULED" | "PUBLISHING" | "PUBLISHED" | "PARTIALLY_PUBLISHED" | "FAILED";
  clipTitle: string;
  clipHref: string;
}

export default function CalendarDayCell({
  day,
  dateIso,
  scheduledPost,
}: {
  day: number;
  dateIso: string;
  scheduledPost: ScheduledPostView | null;
}) {
  const [reassignOpen, setReassignOpen] = useState(false);
  const [newDate, setNewDate] = useState(dateIso.slice(0, 10));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function cancel() {
    if (!scheduledPost) return;
    setError(null);
    startTransition(async () => {
      try {
        await cancelScheduledPost(scheduledPost.id);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });
  }

  function reassign() {
    if (!scheduledPost) return;
    setError(null);
    startTransition(async () => {
      try {
        await reassignScheduledPost(scheduledPost.id, new Date(newDate).toISOString());
        setReassignOpen(false);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });
  }

  return (
    <div className={styles.dayCell}>
      <div className={styles.dayNumber}>{day}</div>
      {scheduledPost && (
        <div className={styles.postCard}>
          <Link href={scheduledPost.clipHref} className={styles.postTitle}>
            {scheduledPost.clipTitle}
          </Link>
          <span className={styles.badge}>{scheduledPost.status}</span>

          {scheduledPost.status === "SCHEDULED" && (
            <div className={styles.postActions}>
              <button type="button" onClick={() => setReassignOpen((v) => !v)} disabled={pending}>
                Move
              </button>
              <button type="button" onClick={cancel} disabled={pending}>
                Cancel
              </button>
            </div>
          )}

          {reassignOpen && (
            <div className={styles.reassignForm}>
              <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
              <button type="button" onClick={reassign} disabled={pending}>
                Save
              </button>
            </div>
          )}

          {error && <p className={styles.error}>{error}</p>}
        </div>
      )}
    </div>
  );
}
