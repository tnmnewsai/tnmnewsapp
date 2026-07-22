import fs from "node:fs";
import path from "node:path";
import type { FetchedMedia } from "./types";

/** Persists an already-uploaded file (dashboard wrote it to a temp path) into the job's working dir. */
export async function adoptUploadedFile(
  tempPath: string,
  destDir: string,
  originalFilename: string,
): Promise<FetchedMedia> {
  fs.mkdirSync(destDir, { recursive: true });
  const ext = path.extname(originalFilename).replace(".", "") || "mp4";
  const localPath = path.join(destDir, `source.${ext}`);
  fs.copyFileSync(tempPath, localPath);
  return { localPath, ext, originalFilename };
}
