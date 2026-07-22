import fs from "node:fs";
import path from "node:path";
import { getYtDlp } from "./binary";
import type { FetchedMedia } from "./types";

export async function fetchYouTubeVideo(url: string, destDir: string): Promise<FetchedMedia> {
  fs.mkdirSync(destDir, { recursive: true });
  const ytDlp = await getYtDlp();

  const infoRaw = await ytDlp.getVideoInfo(url);
  const info = infoRaw as { title?: string; duration?: number };

  const outputTemplate = path.join(destDir, "source.%(ext)s");
  await ytDlp.execPromise([
    url,
    "-f",
    "bv*+ba/b",
    "--merge-output-format",
    "mp4",
    "--no-playlist",
    "-o",
    outputTemplate,
  ]);

  const files = fs.readdirSync(destDir).filter((f) => f.startsWith("source."));
  const file = files[0];
  if (!file) throw new Error(`yt-dlp reported success but no output file was found in ${destDir}`);

  const ext = path.extname(file).replace(".", "");
  return {
    localPath: path.join(destDir, file),
    ext,
    originalFilename: info.title ? `${info.title}.${ext}` : file,
    durationMs: typeof info.duration === "number" ? Math.round(info.duration * 1000) : undefined,
  };
}
