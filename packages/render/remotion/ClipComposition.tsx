import React from "react";
import type { CSSProperties } from "react";
import { AbsoluteFill, Audio, Img, OffthreadVideo, useCurrentFrame, useVideoConfig } from "remotion";
import { POSITION_STYLES } from "./position";
import type { CaptionWord, ClipCompositionProps } from "./types";

interface CaptionLine {
  text: string;
  startMs: number;
  endMs: number;
}

const WORDS_PER_CAPTION_LINE = 4;

function groupCaptionLines(words: CaptionWord[]): CaptionLine[] {
  const lines: CaptionLine[] = [];
  for (let i = 0; i < words.length; i += WORDS_PER_CAPTION_LINE) {
    const chunk = words.slice(i, i + WORDS_PER_CAPTION_LINE);
    const first = chunk[0];
    const last = chunk[chunk.length - 1];
    if (!first || !last) continue;
    lines.push({
      text: chunk.map((w) => w.word).join(" "),
      startMs: first.startMs,
      endMs: last.endMs,
    });
  }
  return lines;
}

const CAPTION_VERTICAL: Record<"top" | "center" | "bottom", CSSProperties> = {
  top: { justifyContent: "flex-start", alignItems: "center" },
  center: { justifyContent: "center", alignItems: "center" },
  bottom: { justifyContent: "flex-end", alignItems: "center" },
};

export const ClipComposition: React.FC<ClipCompositionProps> = ({
  videoSrc,
  captionWords,
  overlays,
  template,
  musicSrc,
  musicVolume,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const currentMs = (frame / fps) * 1000;

  const captionLines = groupCaptionLines(captionWords);
  const currentLine = captionLines.find((l) => currentMs >= l.startMs && currentMs < l.endMs);
  const activeOverlays = overlays.filter((o) => currentMs >= o.startMs && currentMs < o.endMs);

  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      <OffthreadVideo src={videoSrc} style={{ width: "100%", height: "100%", objectFit: "cover" }} />

      {musicSrc && <Audio src={musicSrc} volume={musicVolume ?? 0.2} />}

      {template && currentLine && (
        <AbsoluteFill
          style={{ display: "flex", padding: 60, ...CAPTION_VERTICAL[template.captionPosition] }}
        >
          <div
            style={{
              fontSize: template.captionFontSize,
              color: template.captionColor,
              backgroundColor: template.captionBackgroundColor,
              padding: "0.3em 0.6em",
              borderRadius: 12,
              fontWeight: 700,
              fontFamily: "sans-serif",
              textAlign: "center",
              maxWidth: "90%",
            }}
          >
            {currentLine.text}
          </div>
        </AbsoluteFill>
      )}

      {template?.logoSrc && (
        <AbsoluteFill
          style={{
            display: "flex",
            flexDirection: "row",
            padding: 40,
            ...POSITION_STYLES[template.logoPosition ?? "top-right"],
          }}
        >
          <Img src={template.logoSrc} style={{ width: 220, height: "auto" }} />
        </AbsoluteFill>
      )}

      {activeOverlays.map((o, i) => (
        // eslint-disable-next-line react/no-array-index-key
        <AbsoluteFill
          key={i}
          style={{ display: "flex", flexDirection: "row", padding: 50, ...POSITION_STYLES[o.position] }}
        >
          {o.type === "text" ? (
            <div
              style={{
                fontSize: 48,
                color: template?.accentColor ?? "#ffffff",
                fontWeight: 700,
                fontFamily: "sans-serif",
                textShadow: "0 2px 8px rgba(0,0,0,0.6)",
              }}
            >
              {o.text}
            </div>
          ) : (
            o.imageSrc && <Img src={o.imageSrc} style={{ maxWidth: 300, maxHeight: 300 }} />
          )}
        </AbsoluteFill>
      ))}
    </AbsoluteFill>
  );
};
