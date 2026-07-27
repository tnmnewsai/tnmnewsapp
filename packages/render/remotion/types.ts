export type OverlayPosition =
  | "top-left"
  | "top-center"
  | "top-right"
  | "center-left"
  | "center"
  | "center-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";

export interface CaptionWord {
  word: string;
  startMs: number;
  endMs: number;
}

export interface OverlayInput {
  type: "text" | "image";
  text?: string;
  imageSrc?: string;
  position: OverlayPosition;
  startMs: number;
  endMs: number;
}

export interface TemplateConfig {
  captionFontSize: number;
  captionColor: string;
  captionBackgroundColor: string;
  captionPosition: "top" | "center" | "bottom";
  accentColor: string;
  logoSrc?: string;
  logoPosition?: "top-left" | "top-right" | "bottom-left" | "bottom-right";
}

/**
 * The index signature is required by Remotion's `CalculateMetadataFunction`/
 * `Composition` typing, which constrains props to `Record<string, unknown>`.
 */
export interface ClipCompositionProps {
  [key: string]: unknown;
  videoSrc: string;
  durationInFrames: number;
  fps: number;
  width: number;
  height: number;
  captionWords: CaptionWord[];
  overlays: OverlayInput[];
  template: TemplateConfig | null;
  musicSrc?: string;
  musicVolume?: number;
}

/**
 * A still cover image — title + short description composited over a base
 * image (an extracted clip frame or a custom uploaded graphic), rendered via
 * `renderStill()` rather than `renderMedia()`.
 */
export interface ThumbnailCompositionProps {
  [key: string]: unknown;
  width: number;
  height: number;
  baseImageSrc: string;
  titleText: string;
  descriptionText: string;
  accentColor: string;
}

export interface BlogVideoSegment {
  imageSrc: string;
  startMs: number;
  endMs: number;
}

/**
 * Blog-to-video's synthesized "raw footage" — a sequence of AI-generated
 * segment images (Ken Burns pan/zoom) under a single narration audio track.
 * No captions/branding here; those get applied later exactly like any other
 * SourceAsset, once this is transcribed and turned into a Clip.
 */
export interface BlogVideoCompositionProps {
  [key: string]: unknown;
  durationInFrames: number;
  fps: number;
  width: number;
  height: number;
  audioSrc: string;
  segments: BlogVideoSegment[];
}
