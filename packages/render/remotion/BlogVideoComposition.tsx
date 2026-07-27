import React from "react";
import { AbsoluteFill, Audio, Img, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { BlogVideoCompositionProps } from "./types";

const ZOOM_START = 1;
const ZOOM_END = 1.15;

export const BlogVideoComposition: React.FC<BlogVideoCompositionProps> = ({
  audioSrc,
  segments,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const currentMs = (frame / fps) * 1000;

  const activeIndex = segments.findIndex((s) => currentMs >= s.startMs && currentMs < s.endMs);
  const active = segments[activeIndex] ?? segments[segments.length - 1];

  const scale = active
    ? interpolate(currentMs, [active.startMs, active.endMs], [ZOOM_START, ZOOM_END], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      })
    : 1;

  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      <Audio src={audioSrc} />

      {active && (
        <AbsoluteFill style={{ overflow: "hidden" }}>
          <Img
            src={active.imageSrc}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              transform: `scale(${scale})`,
              transformOrigin: "center",
            }}
          />
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};
