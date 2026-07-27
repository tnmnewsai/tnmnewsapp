import React from "react";
import { Composition, Still } from "remotion";
import { ClipComposition } from "./ClipComposition";
import { ThumbnailComposition } from "./ThumbnailComposition";
import { BlogVideoComposition } from "./BlogVideoComposition";
import type { BlogVideoCompositionProps, ClipCompositionProps, ThumbnailCompositionProps } from "./types";

const defaultClipProps: ClipCompositionProps = {
  videoSrc: "",
  durationInFrames: 150,
  fps: 30,
  width: 1080,
  height: 1920,
  captionWords: [],
  overlays: [],
  template: null,
};

const defaultThumbnailProps: ThumbnailCompositionProps = {
  width: 1080,
  height: 1920,
  baseImageSrc: "",
  titleText: "",
  descriptionText: "",
  accentColor: "#f97316",
};

const defaultBlogVideoProps: BlogVideoCompositionProps = {
  durationInFrames: 150,
  fps: 30,
  width: 1080,
  height: 1920,
  audioSrc: "",
  segments: [],
};

/**
 * Duration/fps/dimensions come from `inputProps` at render time (every clip
 * is a different length) via `calculateMetadata`, rather than being fixed
 * here — the values below are just Remotion Studio preview defaults.
 */
export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="ClipComposition"
        component={ClipComposition}
        durationInFrames={defaultClipProps.durationInFrames}
        fps={defaultClipProps.fps}
        width={defaultClipProps.width}
        height={defaultClipProps.height}
        defaultProps={defaultClipProps}
        calculateMetadata={async ({ props }) => ({
          durationInFrames: props.durationInFrames,
          fps: props.fps,
          width: props.width,
          height: props.height,
        })}
      />
      <Still
        id="ThumbnailComposition"
        component={ThumbnailComposition}
        width={defaultThumbnailProps.width}
        height={defaultThumbnailProps.height}
        defaultProps={defaultThumbnailProps}
        calculateMetadata={async ({ props }) => ({
          width: props.width,
          height: props.height,
        })}
      />
      <Composition
        id="BlogVideoComposition"
        component={BlogVideoComposition}
        durationInFrames={defaultBlogVideoProps.durationInFrames}
        fps={defaultBlogVideoProps.fps}
        width={defaultBlogVideoProps.width}
        height={defaultBlogVideoProps.height}
        defaultProps={defaultBlogVideoProps}
        calculateMetadata={async ({ props }) => ({
          durationInFrames: props.durationInFrames,
          fps: props.fps,
          width: props.width,
          height: props.height,
        })}
      />
    </>
  );
};
