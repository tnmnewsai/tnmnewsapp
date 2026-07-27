import styles from "./sources.module.css";

interface SnapshotView {
  id: string;
  interval: "PLUS_1H" | "PLUS_24H" | "PLUS_7D" | "WEEKLY";
  dueAt: string;
  capturedAt: string | null;
  status: "PENDING" | "SUCCESS" | "FAILED";
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  errorMessage: string | null;
}

interface ResultView {
  id: string;
  platform: string;
  platformUrl: string | null;
  publishedAt: string | null;
  snapshots: SnapshotView[];
}

const INTERVAL_LABELS: Record<SnapshotView["interval"], string> = {
  PLUS_1H: "+1h",
  PLUS_24H: "+24h",
  PLUS_7D: "+7d",
  WEEKLY: "weekly",
};

/** Read-only — analytics are pulled automatically by the pull-analytics-snapshots cron sweep, nothing to trigger here. */
export default function AnalyticsSection({ results }: { results: ResultView[] }) {
  if (results.length === 0) {
    return <p className={styles.empty}>Nothing published yet — analytics show up once a post goes live.</p>;
  }

  return (
    <div className={styles.brandingSection}>
      {results.map((r) => (
        <div key={r.id}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.4rem" }}>
            <strong>{r.platform}</strong>
            {r.publishedAt && <span className={styles.badge}>{new Date(r.publishedAt).toLocaleString()}</span>}
            {r.platformUrl && (
              <a href={r.platformUrl} target="_blank" rel="noreferrer">
                View live post
              </a>
            )}
          </div>

          <ul className={styles.overlayList}>
            {r.snapshots.map((s) => (
              <li key={s.id}>
                <span>
                  <span className={styles.badge}>{INTERVAL_LABELS[s.interval]}</span>{" "}
                  {s.status === "SUCCESS" ? (
                    <>
                      views: {s.views ?? "—"} · likes: {s.likes ?? "—"} · comments: {s.comments ?? "—"} ·
                      shares: {s.shares ?? "—"}
                      {s.capturedAt && (
                        <span style={{ color: "#62667a" }}> (pulled {new Date(s.capturedAt).toLocaleString()})</span>
                      )}
                    </>
                  ) : s.status === "FAILED" ? (
                    <span className={styles.error}>{s.errorMessage}</span>
                  ) : (
                    <span style={{ color: "#62667a" }}>due {new Date(s.dueAt).toLocaleString()}</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
