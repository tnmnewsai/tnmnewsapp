export interface ModerationTextItem {
  kind: "text";
  label: string;
  text: string;
}

export interface ModerationFrameItem {
  kind: "frame";
  label: string;
  /** Local path to a still image (e.g. an extracted video frame). */
  imagePath: string;
}

export type ModerationItem = ModerationTextItem | ModerationFrameItem;

export interface ModerationDetail {
  kind: "text" | "frame";
  label: string;
  flagged: boolean;
  /** Flagged category keys from OpenAI's moderation taxonomy, e.g. "violence". */
  categories: string[];
}

export interface ModerationResult {
  flagged: boolean;
  details: ModerationDetail[];
}
