import React from "react";
import { AbsoluteFill, Img } from "remotion";
import type { ThumbnailCompositionProps } from "./types";

/**
 * YouTube-thumbnail-style still: base image full-bleed, a dark gradient
 * scrim at the bottom for text legibility over any image, bold title, and a
 * smaller description underneath — same look regardless of what the base
 * image is (extracted frame or custom upload).
 */
export const ThumbnailComposition: React.FC<ThumbnailCompositionProps> = ({
  baseImageSrc,
  titleText,
  descriptionText,
  accentColor,
}) => {
  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      <Img src={baseImageSrc} style={{ width: "100%", height: "100%", objectFit: "cover" }} />

      <AbsoluteFill
        style={{
          background:
            "linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.35) 40%, rgba(0,0,0,0) 65%)",
        }}
      />

      <AbsoluteFill
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          alignItems: "flex-start",
          padding: 64,
          gap: 20,
        }}
      >
        <div style={{ width: 88, height: 10, backgroundColor: accentColor, borderRadius: 5 }} />
        <div
          style={{
            fontSize: 76,
            fontWeight: 800,
            color: "#ffffff",
            fontFamily: "sans-serif",
            lineHeight: 1.05,
            textShadow: "0 4px 16px rgba(0,0,0,0.6)",
            maxWidth: "92%",
          }}
        >
          {titleText}
        </div>
        <div
          style={{
            fontSize: 38,
            fontWeight: 500,
            color: "rgba(255,255,255,0.92)",
            fontFamily: "sans-serif",
            maxWidth: "88%",
            textShadow: "0 2px 8px rgba(0,0,0,0.6)",
          }}
        >
          {descriptionText}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
