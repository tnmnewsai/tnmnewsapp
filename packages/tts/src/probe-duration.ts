import { spawn } from "node:child_process";
// @ts-expect-error - ffprobe-static ships no types
import ffprobeStatic from "ffprobe-static";

interface FfprobeFormat {
  format?: { duration?: string };
}

/** Real duration (not an estimate) drives how long each segment's image is shown on screen. */
export function probeAudioDurationMs(audioPath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const proc = spawn(ffprobeStatic.path as string, [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "json",
      audioPath,
    ]);

    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    proc.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`ffprobe failed (code ${code}):\n${stderr.slice(-2000)}`));
        return;
      }
      try {
        const parsed = JSON.parse(stdout) as FfprobeFormat;
        const seconds = Number(parsed.format?.duration);
        if (!Number.isFinite(seconds)) throw new Error("ffprobe returned no duration");
        resolve(Math.round(seconds * 1000));
      } catch (err) {
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    });
  });
}
