import { spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import ffmpegPath from "ffmpeg-static";

/** Same-codec mp3 segments from a single TTS provider — concat demuxer + stream copy is safe and fast here. */
export function concatenateAudioFiles(inputPaths: string[], outputPath: string): Promise<void> {
  const listFile = path.join(
    path.dirname(outputPath),
    `concat-list-${crypto.randomUUID()}.txt`,
  );
  const listContent = inputPaths
    .map((p) => `file '${p.replace(/'/g, "'\\''")}'`)
    .join("\n");
  fs.writeFileSync(listFile, listContent);

  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegPath as string, [
      "-y",
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      listFile,
      "-c",
      "copy",
      outputPath,
    ]);

    let stderr = "";
    proc.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    proc.on("error", reject);
    proc.on("close", (code) => {
      fs.rmSync(listFile, { force: true });
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg audio concat failed (code ${code}):\n${stderr.slice(-2000)}`));
    });
  });
}
