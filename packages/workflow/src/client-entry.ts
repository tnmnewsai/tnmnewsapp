/**
 * Safe for apps/dashboard to import: the Inngest client (for `.send()`),
 * pure types, and any function whose own dependency chain stays clear of
 * `@svt/render` → `@remotion/renderer`'s platform-specific native compositor
 * binaries — those break Next.js's build on any machine that isn't the
 * target Linux platform. Rendering itself only ever runs in apps/worker.
 * Never re-export anything from `./index.ts` here, even transitively.
 */
export { inngest } from "./client";
export type {
  BrandTemplateConfig,
  ClipEditState,
  ClipOverlay,
  ClipSegment,
  ContentApprovalDecidedEvent,
  ContentApprovalDecision,
  OverlayPosition,
  TranscriptWord,
} from "./types";
export { resolvePlatformAppCredentials } from "./lib/resolve-app-credentials";
