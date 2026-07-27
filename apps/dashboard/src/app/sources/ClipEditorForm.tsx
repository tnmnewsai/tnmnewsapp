"use client";

import { useRef, useState, useTransition } from "react";
import styles from "./sources.module.css";

function formatMs(ms: number): string {
  const totalSeconds = ms / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = (totalSeconds % 60).toFixed(1);
  return `${minutes}:${seconds.padStart(4, "0")}`;
}

export interface ClipEditorFormProps {
  videoSrc: string;
  initialTitle?: string;
  initialStartMs?: number;
  initialEndMs?: number;
  submitLabel: string;
  onSubmit: (input: { title: string; startMs: number; endMs: number }) => Promise<void>;
  onDelete?: () => Promise<void>;
}

export default function ClipEditorForm({
  videoSrc,
  initialTitle = "",
  initialStartMs = 0,
  initialEndMs = 5000,
  submitLabel,
  onSubmit,
  onDelete,
}: ClipEditorFormProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [title, setTitle] = useState(initialTitle);
  const [startMs, setStartMs] = useState(initialStartMs);
  const [endMs, setEndMs] = useState(initialEndMs);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function markStart() {
    if (videoRef.current) setStartMs(Math.round(videoRef.current.currentTime * 1000));
  }

  function markEnd() {
    if (videoRef.current) setEndMs(Math.round(videoRef.current.currentTime * 1000));
  }

  function previewRange() {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = startMs / 1000;
    void video.play();

    const onTimeUpdate = () => {
      if (video.currentTime * 1000 >= endMs) {
        video.pause();
        video.removeEventListener("timeupdate", onTimeUpdate);
      }
    };
    video.addEventListener("timeupdate", onTimeUpdate);
  }

  function submit() {
    setError(null);
    if (!title.trim()) {
      setError("Give the clip a title.");
      return;
    }
    if (endMs <= startMs) {
      setError("End must be after start.");
      return;
    }
    startTransition(async () => {
      try {
        await onSubmit({ title, startMs, endMs });
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });
  }

  function remove() {
    if (!onDelete) return;
    if (!confirm("Delete this clip?")) return;
    startTransition(async () => {
      try {
        await onDelete();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });
  }

  return (
    <div className={styles.clipEditor}>
      <video ref={videoRef} src={videoSrc} controls className={styles.video} />

      <div className={styles.clipControls}>
        <label>
          Title
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Clip title" />
        </label>

        <div className={styles.rangeRow}>
          <span>Start: {formatMs(startMs)}</span>
          <button type="button" onClick={markStart}>
            Set to current time
          </button>
        </div>
        <div className={styles.rangeRow}>
          <span>End: {formatMs(endMs)}</span>
          <button type="button" onClick={markEnd}>
            Set to current time
          </button>
        </div>

        <button type="button" onClick={previewRange}>
          ▶ Preview clip range
        </button>

        {error && <p className={styles.error}>{error}</p>}

        <div className={styles.formActions}>
          <button type="button" onClick={submit} disabled={pending}>
            {pending ? "Saving…" : submitLabel}
          </button>
          {onDelete && (
            <button type="button" onClick={remove} disabled={pending}>
              Delete clip
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
