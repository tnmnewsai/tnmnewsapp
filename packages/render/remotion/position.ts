import type { CSSProperties } from "react";
import type { OverlayPosition } from "./types";

export const POSITION_STYLES: Record<OverlayPosition, CSSProperties> = {
  "top-left": { justifyContent: "flex-start", alignItems: "flex-start" },
  "top-center": { justifyContent: "center", alignItems: "flex-start" },
  "top-right": { justifyContent: "flex-end", alignItems: "flex-start" },
  "center-left": { justifyContent: "flex-start", alignItems: "center" },
  center: { justifyContent: "center", alignItems: "center" },
  "center-right": { justifyContent: "flex-end", alignItems: "center" },
  "bottom-left": { justifyContent: "flex-start", alignItems: "flex-end" },
  "bottom-center": { justifyContent: "center", alignItems: "flex-end" },
  "bottom-right": { justifyContent: "flex-end", alignItems: "flex-end" },
};
