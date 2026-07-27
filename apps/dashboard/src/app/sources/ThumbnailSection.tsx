"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createThumbnailAsset, deleteThumbnailAsset } from "./actions";
import styles from "./sources.module.css";

interface RenderOption {
  id: string;
  aspectRatio: string;
}

interface GraphicOption {
  id: string;
  name: string;
}

export interface ThumbnailAssetView {
  id: string;
  titleText: string;
  descriptionText: string;
  status: "PENDING" | "RENDERING" | "READY" | "FAILED";
  errorMessage: string | null;
}

export default function ThumbnailSection({
  clipId,
  clipDurationSec,
  renderOptions,
  graphicOptions,
  thumbnails,
}: {
  clipId: string;
  clipDurationSec: number;
  renderOptions: RenderOption[];
  graphicOptions: GraphicOption[];
  thumbnails: ThumbnailAssetView[];
}) {
  const [source, setSource] = useState<"frame" | "graphic">(renderOptions.length ? "frame" : "graphic");
  const [renderId, setRenderId] = useState(renderOptions[0]?.id ?? "");
  const [frameSec, setFrameSec] = useState(Math.min(1, clipDurationSec / 2));
  const [graphicAssetId, setGraphicAssetId] = useState(graphicOptions[0]?.id ?? "");
  const [titleText, setTitleText] = useState("");
  const [descriptionText, setDescriptionText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function generate() {
    setError(null);
    startTransition(async () => {
      try {
        await createThumbnailAsset(clipId, {
          titleText,
          descriptionText,
          sourceRenderedClipAssetId: source === "frame" ? renderId : undefined,
          sourceFrameMs: source === "frame" ? Math.round(frameSec * 1000) : undefined,
          customBaseImageGraphicAssetId: source === "graphic" ? graphicAssetId : undefined,
        });
        setTitleText("");
        setDescriptionText("");
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });
  }

  function remove(thumbnailAssetId: string) {
    startTransition(async () => {
      try {
        await deleteThumbnailAsset(thumbnailAssetId);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });
  }

  const canGenerate = source === "frame" ? Boolean(renderId) : Boolean(graphicAssetId);

  return (
    <div className={styles.brandingSection}>
      {renderOptions.length === 0 && graphicOptions.length === 0 ? (
        <p className={styles.empty}>Render a branded clip or upload a graphic asset first.</p>
      ) : (
        <>
          <div className={styles.overlayDraft}>
            <select value={source} onChange={(e) => setSource(e.target.value as "frame" | "graphic")}>
              {renderOptions.length > 0 && <option value="frame">Frame from a render</option>}
              {graphicOptions.length > 0 && <option value="graphic">Custom graphic asset</option>}
            </select>

            {source === "frame" ? (
              <>
                <select value={renderId} onChange={(e) => setRenderId(e.target.value)}>
                  {renderOptions.map((r) => (
                    <option key={r.id} value={r.id}>
                      render {r.aspectRatio}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  step={0.1}
                  min={0}
                  max={clipDurationSec}
                  value={frameSec}
                  onChange={(e) => setFrameSec(Number(e.target.value))}
                  aria-label="Frame timestamp seconds"
                />
                <span>s</span>
              </>
            ) : (
              <select value={graphicAssetId} onChange={(e) => setGraphicAssetId(e.target.value)}>
                {graphicOptions.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <label>
            Title
            <input
              type="text"
              value={titleText}
              onChange={(e) => setTitleText(e.target.value)}
              placeholder="Bold, punchy title"
            />
          </label>

          <label>
            Short description
            <input
              type="text"
              value={descriptionText}
              onChange={(e) => setDescriptionText(e.target.value)}
              placeholder="One line for engagement"
            />
          </label>

          {error && <p className={styles.error}>{error}</p>}
          <button type="button" onClick={generate} disabled={pending || !canGenerate || !titleText.trim()}>
            {pending ? "Generating…" : "Generate thumbnail"}
          </button>
        </>
      )}

      {thumbnails.length > 0 && (
        <ul className={styles.overlayList}>
          {thumbnails.map((t) => (
            <li key={t.id}>
              <span style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                {t.status === "READY" && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`/api/thumbnail-assets/${t.id}/image`}
                    alt={t.titleText}
                    style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 6 }}
                  />
                )}
                <span>
                  &ldquo;{t.titleText}&rdquo; — {t.descriptionText} <span className={styles.badge}>{t.status}</span>
                  {t.status === "FAILED" && t.errorMessage && <span className={styles.error}> {t.errorMessage}</span>}
                </span>
              </span>
              <button type="button" onClick={() => remove(t.id)}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
