import { spawn } from "node:child_process";
import path from "node:path";
import ffmpegPath from "ffmpeg-static";

/** Extracts a 16kHz mono mp3 track, or returns null when the video is silent. */
export function extractAudio(videoPath: string, destDir: string): Promise<string | null> {
  const outPath = path.join(destDir, "audio.mp3");

  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegPath as string, [
      "-y",
      "-i",
      videoPath,
      "-vn",
      "-ac",
      "1",
      "-ar",
      "16000",
      "-b:a",
      "64k",
      outPath,
    ]);

    let stderr = "";
    proc.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code === 0) {
        resolve(outPath);
      } else if (
        stderr.includes("Output file does not contain any stream") ||
        stderr.includes("matches no streams")
      ) {
        resolve(null);
      } else {
        reject(new Error(`ffmpeg audio extraction failed (code ${code}):\n${stderr.slice(-2000)}`));
      }
    });
  });
}
