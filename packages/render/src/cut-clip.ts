import { spawn } from "node:child_process";
import ffmpegPath from "ffmpeg-static";

export interface CutClipInput {
  sourceVideoPath: string;
  startMs: number;
  endMs: number;
  outputPath: string;
}

/**
 * Milestone 4 scope: trim + re-encode only, at the source's original
 * resolution/aspect ratio — no captions, brand template, or per-platform
 * variants yet (Milestone 5+). `-i` before `-ss` means output-seeking
 * (frame-accurate, decodes from the start) rather than the faster but
 * keyframe-snapped input-seeking — correctness over speed for a "cut
 * exactly where the human marked it" feature.
 */
export function cutClip(input: CutClipInput): Promise<void> {
  const startSec = input.startMs / 1000;
  const durationSec = (input.endMs - input.startMs) / 1000;

  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegPath as string, [
      "-y",
      "-i",
      input.sourceVideoPath,
      "-ss",
      String(startSec),
      "-t",
      String(durationSec),
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "20",
      "-c:a",
      "aac",
      "-movflags",
      "+faststart",
      input.outputPath,
    ]);

    let stderr = "";
    proc.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg cut failed (code ${code}):\n${stderr.slice(-2000)}`));
    });
  });
}
