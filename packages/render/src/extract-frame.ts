import { spawn } from "node:child_process";
import ffmpegPath from "ffmpeg-static";

export interface ExtractFrameInput {
  sourceVideoPath: string;
  atMs: number;
  outputPath: string;
}

/**
 * Output-seeking (`-i` before `-ss`) for frame accuracy, same reasoning as
 * `cutClip` — thumbnail frames are pulled from an already-cut, short clip so
 * the slower decode-from-start cost is negligible.
 */
export function extractFrame(input: ExtractFrameInput): Promise<void> {
  const atSec = input.atMs / 1000;

  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegPath as string, [
      "-y",
      "-i",
      input.sourceVideoPath,
      "-ss",
      String(atSec),
      "-frames:v",
      "1",
      input.outputPath,
    ]);

    let stderr = "";
    proc.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg frame extraction failed (code ${code}):\n${stderr.slice(-2000)}`));
    });
  });
}
