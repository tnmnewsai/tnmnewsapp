import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { getStorage } from "@svt/storage";
import { extractFrame } from "@svt/render";
import { runModeration } from "@svt/moderation";
import type { ModerationItem, ModerationResult } from "@svt/moderation";

export interface ModerationCheckInput {
  storageKey: string;
  durationMs: number;
  captionText: string;
  overlayTexts: string[];
}

/** Sampled instead of every frame — cheap enough to catch sustained issues without a per-frame API call over a whole clip. */
const FRAME_FRACTIONS = [0.1, 0.5, 0.9];

export async function runRenderModerationCheck(input: ModerationCheckInput): Promise<ModerationResult> {
  return getStorage().withLocalFile(input.storageKey, async (videoPath) => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "svt-moderation-"));
    try {
      const items: ModerationItem[] = [];

      for (const [i, fraction] of FRAME_FRACTIONS.entries()) {
        const framePath = path.join(tempDir, `frame-${i}.png`);
        await extractFrame({
          sourceVideoPath: videoPath,
          atMs: Math.round(input.durationMs * fraction),
          outputPath: framePath,
        });
        items.push({ kind: "frame", label: `frame@${Math.round(fraction * 100)}%`, imagePath: framePath });
      }

      if (input.captionText.trim()) {
        items.push({ kind: "text", label: "captions", text: input.captionText });
      }
      input.overlayTexts.forEach((text, i) => {
        if (text.trim()) items.push({ kind: "text", label: `overlay-${i}`, text });
      });

      return runModeration(items);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
}
