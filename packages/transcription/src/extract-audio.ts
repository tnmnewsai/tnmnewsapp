import { spawn } from "node:child_process";
import path from "node:path";
import ffmpegPath from "ffmpeg-static";

/** Extracts a 16kHz mono mp3 track — small enough to upload quickly, plenty for ASR. */
export function extractAudio(videoPath: string, destDir: string): Promise<string> {
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
      if (code === 0) resolve(outPath);
      else reject(new Error(`ffmpeg audio extraction failed (code ${code}):\n${stderr.slice(-2000)}`));
    });
  });
}
