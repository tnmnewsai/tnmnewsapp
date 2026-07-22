import fs from "node:fs";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import type { FetchedMedia } from "./types";

const FILE_ID_PATTERNS = [/\/file\/d\/([\w-]+)/, /[?&]id=([\w-]+)/];

export function extractDriveFileId(url: string): string {
  for (const pattern of FILE_ID_PATTERNS) {
    const match = url.match(pattern);
    if (match?.[1]) return match[1];
  }
  throw new Error(`Could not find a Google Drive file id in URL: ${url}`);
}

/**
 * Downloads a file shared as "Anyone with the link can view" without any
 * OAuth/service-account credentials, using Drive's public content endpoint.
 * Only works for publicly-shared files — private files need a future
 * service-account-based Drive API integration.
 */
export async function fetchDriveVideo(url: string, destDir: string): Promise<FetchedMedia> {
  fs.mkdirSync(destDir, { recursive: true });
  const fileId = extractDriveFileId(url);

  const response = await fetch(
    `https://drive.usercontent.google.com/download?id=${fileId}&export=download&confirm=t`,
  );

  const contentType = response.headers.get("content-type") ?? "";
  if (!response.ok || contentType.includes("text/html")) {
    throw new Error(
      `Google Drive did not return a file for id ${fileId}. Make sure it's shared as ` +
        `"Anyone with the link" can view, and that it isn't blocked by a download quota.`,
    );
  }

  const ext = extFromContentType(contentType);
  const localPath = path.join(destDir, `source.${ext}`);
  if (!response.body) throw new Error("Drive response had no body");

  await pipeline(Readable.fromWeb(response.body as never), fs.createWriteStream(localPath));

  return { localPath, ext };
}

function extFromContentType(contentType: string): string {
  if (contentType.includes("mp4")) return "mp4";
  if (contentType.includes("quicktime")) return "mov";
  if (contentType.includes("webm")) return "webm";
  if (contentType.includes("x-matroska")) return "mkv";
  return "mp4";
}
