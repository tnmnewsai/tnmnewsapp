"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Platform } from "@svt/publishing-core";
import { scheduleClipForPublishing } from "./actions";
import styles from "./sources.module.css";

const ALL_PLATFORMS = ["YOUTUBE", "META", "FACEBOOK", "TIKTOK", "X"] as const;

export interface ScheduledPostPackageView {
  id: string;
  platform: string;
  status: "PENDING" | "MANUAL_FALLBACK" | "PUBLISHING" | "PUBLISHED" | "FAILED";
  title: string;
  description: string;
  tags: string[];
  hasVideo: boolean;
  hasThumbnail: boolean;
  errorMessage: string | null;
  platformUrl: string | null;
}

export interface ScheduledPostView {
  id: string;
  scheduledFor: string;
  status: "SCHEDULED" | "PUBLISHING" | "PUBLISHED" | "PARTIALLY_PUBLISHED" | "FAILED";
  packages: ScheduledPostPackageView[];
}

function defaultScheduledFor(): string {
  const d = new Date(Date.now() + 5 * 60 * 1000);
  d.setSeconds(0, 0);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60 * 1000).toISOString().slice(0, 16);
}

export default function ScheduleSection({
  clipId,
  canSchedule,
  connectedPlatforms,
  scheduledPosts,
}: {
  clipId: string;
  canSchedule: boolean;
  connectedPlatforms: string[];
  scheduledPosts: ScheduledPostView[];
}) {
  const [scheduledFor, setScheduledFor] = useState(defaultScheduledFor);
  const [platforms, setPlatforms] = useState<Platform[]>(["YOUTUBE"]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function togglePlatform(p: Platform) {
    setPlatforms((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));
  }

  function schedule() {
    setError(null);
    startTransition(async () => {
      try {
        await scheduleClipForPublishing(clipId, {
          scheduledFor: new Date(scheduledFor).toISOString(),
          platforms,
        });
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });
  }

  if (!canSchedule) {
    return <p className={styles.empty}>Passes Gate 2 (publishing approval) before scheduling unlocks.</p>;
  }

  return (
    <div className={styles.brandingSection}>
      <label>
        Publish at
        <input
          type="datetime-local"
          value={scheduledFor}
          onChange={(e) => setScheduledFor(e.target.value)}
        />
      </label>

      <div className={styles.overlayDraft}>
        {ALL_PLATFORMS.map((p) => (
          <label key={p} style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
            <input type="checkbox" checked={platforms.includes(p)} onChange={() => togglePlatform(p)} />
            {p}
            {!connectedPlatforms.includes(p) && <span className={styles.badge}>manual fallback</span>}
          </label>
        ))}
      </div>

      {error && <p className={styles.error}>{error}</p>}
      <button type="button" onClick={schedule} disabled={pending || platforms.length === 0}>
        {pending ? "Scheduling…" : "Schedule"}
      </button>

      {scheduledPosts.length > 0 && (
        <ul className={styles.overlayList}>
          {scheduledPosts.map((sp) => (
            <li key={sp.id} style={{ flexDirection: "column", alignItems: "flex-start", gap: "0.4rem" }}>
              <div>
                {new Date(sp.scheduledFor).toLocaleString()} — <span className={styles.badge}>{sp.status}</span>
              </div>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "0.4rem", width: "100%" }}>
                {sp.packages.map((pkg) => (
                  <li key={pkg.id} style={{ background: "#f3f2f7", borderRadius: 6, padding: "0.5rem 0.6rem" }}>
                    <div>
                      <strong>{pkg.platform}</strong> <span className={styles.badge}>{pkg.status}</span>
                    </div>
                    {pkg.status === "MANUAL_FALLBACK" && (
                      <div style={{ fontSize: "0.85rem", marginTop: "0.3rem" }}>
                        <div>{pkg.title && <strong>{pkg.title}</strong>}</div>
                        <div>{pkg.description}</div>
                        {pkg.tags.length > 0 && (
                          <div style={{ color: "#62667a" }}>{pkg.tags.map((t) => `#${t}`).join(" ")}</div>
                        )}
                        <div style={{ marginTop: "0.3rem" }}>
                          {pkg.hasVideo && (
                            <a href={`/api/publishing-packages/${pkg.id}/video`} target="_blank" rel="noreferrer">
                              Download video
                            </a>
                          )}
                          {pkg.hasThumbnail && (
                            <>
                              {" "}
                              ·{" "}
                              <a href={`/api/publishing-packages/${pkg.id}/thumbnail`} target="_blank" rel="noreferrer">
                                Download thumbnail
                              </a>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                    {pkg.platformUrl && (
                      <div style={{ fontSize: "0.85rem", marginTop: "0.3rem" }}>
                        <a href={pkg.platformUrl} target="_blank" rel="noreferrer">
                          View live post
                        </a>
                      </div>
                    )}
                    {pkg.errorMessage && <p className={styles.error}>{pkg.errorMessage}</p>}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
