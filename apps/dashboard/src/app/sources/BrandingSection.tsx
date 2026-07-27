"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveClipBranding } from "./actions";
import type { OverlayPosition } from "@svt/workflow/client";
import styles from "./sources.module.css";

const POSITIONS: OverlayPosition[] = [
  "top-left",
  "top-center",
  "top-right",
  "center-left",
  "center",
  "center-right",
  "bottom-left",
  "bottom-center",
  "bottom-right",
];

interface Overlay {
  type: "text" | "image";
  text?: string;
  graphicAssetId?: string;
  position: OverlayPosition;
  startMs: number;
  endMs: number;
}

export default function BrandingSection({
  clipId,
  initialOverlays,
  initialMusicTrackId,
  initialMusicVolume,
  initialBrandTemplateId,
  graphicAssets,
  musicTracks,
  brandTemplates,
}: {
  clipId: string;
  initialOverlays: Overlay[];
  initialMusicTrackId?: string;
  initialMusicVolume?: number;
  initialBrandTemplateId?: string;
  graphicAssets: { id: string; name: string }[];
  musicTracks: { id: string; name: string }[];
  brandTemplates: { id: string; name: string; version: number }[];
}) {
  const [overlays, setOverlays] = useState<Overlay[]>(initialOverlays);
  const [musicTrackId, setMusicTrackId] = useState(initialMusicTrackId ?? "");
  const [musicVolume, setMusicVolume] = useState(initialMusicVolume ?? 0.2);
  const [brandTemplateId, setBrandTemplateId] = useState(initialBrandTemplateId ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(true);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const [draftType, setDraftType] = useState<"text" | "image">("text");
  const [draftText, setDraftText] = useState("");
  const [draftGraphicAssetId, setDraftGraphicAssetId] = useState("");
  const [draftPosition, setDraftPosition] = useState<OverlayPosition>("bottom-center");
  const [draftStartSec, setDraftStartSec] = useState(0);
  const [draftEndSec, setDraftEndSec] = useState(3);

  function addOverlay() {
    if (draftType === "text" && !draftText.trim()) return;
    if (draftType === "image" && !draftGraphicAssetId) return;

    setOverlays((prev) => [
      ...prev,
      {
        type: draftType,
        text: draftType === "text" ? draftText.trim() : undefined,
        graphicAssetId: draftType === "image" ? draftGraphicAssetId : undefined,
        position: draftPosition,
        startMs: Math.round(draftStartSec * 1000),
        endMs: Math.round(draftEndSec * 1000),
      },
    ]);
    setDraftText("");
    setSaved(false);
  }

  function removeOverlay(index: number) {
    setOverlays((prev) => prev.filter((_, i) => i !== index));
    setSaved(false);
  }

  function save() {
    setError(null);
    startTransition(async () => {
      try {
        await saveClipBranding(clipId, {
          overlays,
          musicTrackId: musicTrackId || undefined,
          musicVolume,
          brandTemplateId: brandTemplateId || undefined,
        });
        setSaved(true);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });
  }

  return (
    <div className={styles.brandingSection}>
      <label>
        Brand template
        <select
          value={brandTemplateId}
          onChange={(e) => {
            setBrandTemplateId(e.target.value);
            setSaved(false);
          }}
        >
          <option value="">Use current (latest version)</option>
          {brandTemplates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name} v{t.version}
            </option>
          ))}
        </select>
      </label>

      <label>
        Music track
        <select
          value={musicTrackId}
          onChange={(e) => {
            setMusicTrackId(e.target.value);
            setSaved(false);
          }}
        >
          <option value="">No music</option>
          {musicTracks.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </label>

      {musicTrackId && (
        <label>
          Music volume ({Math.round(musicVolume * 100)}%)
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={musicVolume}
            onChange={(e) => {
              setMusicVolume(Number(e.target.value));
              setSaved(false);
            }}
          />
        </label>
      )}

      <h3>Overlays</h3>
      {overlays.length > 0 && (
        <ul className={styles.overlayList}>
          {overlays.map((o, i) => (
            <li key={`${o.position}-${o.startMs}-${i}`}>
              <span>
                {o.type === "text"
                  ? `"${o.text}"`
                  : `image: ${graphicAssets.find((g) => g.id === o.graphicAssetId)?.name ?? "unknown"}`}{" "}
                @ {o.position}, {(o.startMs / 1000).toFixed(1)}s–{(o.endMs / 1000).toFixed(1)}s
              </span>
              <button type="button" onClick={() => removeOverlay(i)}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className={styles.overlayDraft}>
        <select value={draftType} onChange={(e) => setDraftType(e.target.value as "text" | "image")}>
          <option value="text">Text</option>
          <option value="image">Image</option>
        </select>

        {draftType === "text" ? (
          <input
            value={draftText}
            onChange={(e) => setDraftText(e.target.value)}
            placeholder="Overlay text"
          />
        ) : (
          <select value={draftGraphicAssetId} onChange={(e) => setDraftGraphicAssetId(e.target.value)}>
            <option value="">Choose graphic…</option>
            {graphicAssets.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        )}

        <select value={draftPosition} onChange={(e) => setDraftPosition(e.target.value as OverlayPosition)}>
          {POSITIONS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>

        <input
          type="number"
          step={0.1}
          min={0}
          value={draftStartSec}
          onChange={(e) => setDraftStartSec(Number(e.target.value))}
          aria-label="Overlay start seconds"
        />
        <span>to</span>
        <input
          type="number"
          step={0.1}
          min={0}
          value={draftEndSec}
          onChange={(e) => setDraftEndSec(Number(e.target.value))}
          aria-label="Overlay end seconds"
        />
        <span>s</span>

        <button type="button" onClick={addOverlay}>
          Add overlay
        </button>
      </div>

      {error && <p className={styles.error}>{error}</p>}
      <button type="button" onClick={save} disabled={pending || saved}>
        {pending ? "Saving…" : saved ? "Saved" : "Save branding settings"}
      </button>
    </div>
  );
}
