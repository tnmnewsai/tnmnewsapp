import { spawn } from "node:child_process";
import ffmpegPath from "ffmpeg-static";

/**
 * Fails loudly if a fetched file has no video stream, instead of silently
 * producing an audio-only "video" — exactly the failure mode this project
 * hit once already when a merge step quietly dropped the video track.
 */
export function assertHasVideoStream(filePath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegPath as string, ["-i", filePath]);

    let stderr = "";
    proc.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    proc.on("error", reject);
    proc.on("close", () => {
      if (/Stream #\d+:\d+.*: Video:/.test(stderr)) resolve();
      else reject(new Error(`Fetched file has no video stream (audio-only?): ${filePath}`));
    });
  });
}
