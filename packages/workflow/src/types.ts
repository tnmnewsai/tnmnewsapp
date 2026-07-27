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

export interface ClipSegment {
  startMs: number;
  endMs: number;
}

export interface ClipOverlay {
  type: "text" | "image";
  text?: string;
  graphicAssetId?: string;
  position: OverlayPosition;
  startMs: number;
  endMs: number;
}

/** The shape stored in `Clip.editState` — grows with new keys, never a schema change. */
export interface ClipEditState {
  segments: ClipSegment[];
  overlays?: ClipOverlay[];
  musicTrackId?: string;
  musicVolume?: number;
  brandTemplateId?: string;
}

/** The shape stored in `BrandTemplate.config`. */
export interface BrandTemplateConfig {
  captionFontSize: number;
  captionColor: string;
  captionBackgroundColor: string;
  captionPosition: "top" | "center" | "bottom";
  accentColor: string;
  logoGraphicAssetId?: string;
  logoPosition?: "top-left" | "top-right" | "bottom-left" | "bottom-right";
}

export interface TranscriptWord {
  word: string;
  startMs: number;
  endMs: number;
}

/** Gate 1 (content approval) decision, sent by the dashboard once a reviewer acts on a render. */
export type ContentApprovalDecision = "approved" | "rejected" | "revision_requested";

export interface ContentApprovalDecidedEvent {
  name: "clip/content-approval.decided";
  data: {
    renderedClipAssetId: string;
    decision: ContentApprovalDecision;
    userId: string;
    /** Required when decision is "revision_requested"; optional otherwise. */
    comment?: string;
  };
}
