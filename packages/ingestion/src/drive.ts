import fs from "node:fs";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { assertHasVideoStream } from "./validate-media";
import { getDriveAccessToken } from "./drive-auth";
import type { FetchedMedia } from "./types";

const FILE_ID_PATTERNS = [/\/file\/d\/([\w-]+)/, /[?&]id=([\w-]+)/];
const FOLDER_ID_PATTERN = /\/folders\/([\w-]+)/;

export interface DriveFolderVideo {
  id: string;
  name: string;
  mimeType: string;
}

export function extractDriveFileId(url: string): string {
  for (const pattern of FILE_ID_PATTERNS) {
    const match = url.match(pattern);
    if (match?.[1]) return match[1];
  }
  throw new Error(`Could not find a Google Drive file id in URL: ${url}`);
}

export function extractDriveFolderId(url: string): string {
  const match = url.match(FOLDER_ID_PATTERN);
  if (!match?.[1]) throw new Error(`Could not find a Google Drive folder id in URL: ${url}`);
  return match[1];
}

/**
 * Downloads a Drive file. If GOOGLE_SERVICE_ACCOUNT_KEY_BASE64 is configured,
 * uses the authenticated Drive API (works for private files shared with the
 * service account, not just public links). Otherwise falls back to the
 * original unauthenticated public-content endpoint, which only works for
 * files shared as "Anyone with the link can view".
 */
export async function fetchDriveVideo(url: string, destDir: string): Promise<FetchedMedia> {
  fs.mkdirSync(destDir, { recursive: true });
  const fileId = extractDriveFileId(url);
  const accessToken = await getDriveAccessToken();

  const response = accessToken
    ? await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
    : await fetch(`https://drive.usercontent.google.com/download?id=${fileId}&export=download&confirm=t`);

  const contentType = response.headers.get("content-type") ?? "";
  if (!response.ok || contentType.includes("text/html")) {
    const detail = accessToken
      ? `Make sure the file is shared with the service account (Viewer access is enough).`
      : `Make sure it's shared as "Anyone with the link" can view, and that it isn't blocked by a download quota.`;
    throw new Error(`Google Drive did not return a file for id ${fileId}. ${detail}`);
  }

  const ext = extFromContentType(contentType);
  const localPath = path.join(destDir, `source.${ext}`);
  if (!response.body) throw new Error("Drive response had no body");

  await pipeline(Readable.fromWeb(response.body as never), fs.createWriteStream(localPath));
  await assertHasVideoStream(localPath);

  return { localPath, ext };
}

/**
 * Lists video files directly inside a Drive folder — requires a service
 * account (there's no unauthenticated way to enumerate a folder's contents).
 * Not recursive: subfolders are not walked, matching the "dedicated flat
 * folder of source videos" use case this is built for.
 */
export async function listDriveFolderVideos(folderUrl: string): Promise<DriveFolderVideo[]> {
  const accessToken = await getDriveAccessToken();
  if (!accessToken) {
    throw new Error(
      "GOOGLE_SERVICE_ACCOUNT_KEY_BASE64 is not set. Add it to enable importing a Drive folder's videos.",
    );
  }

  const folderId = extractDriveFolderId(folderUrl);
  const q = encodeURIComponent(`'${folderId}' in parents and mimeType contains 'video/' and trashed = false`);
  const fields = encodeURIComponent("files(id,name,mimeType)");
  const url = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=${fields}&pageSize=200`;

  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) {
    throw new Error(
      `Google Drive folder listing failed: ${res.status} ${res.statusText}. Make sure the folder ` +
        `is shared with the service account (Viewer access is enough).`,
    );
  }

  const data = (await res.json()) as { files?: DriveFolderVideo[] };
  return data.files ?? [];
}

function extFromContentType(contentType: string): string {
  if (contentType.includes("mp4")) return "mp4";
  if (contentType.includes("quicktime")) return "mov";
  if (contentType.includes("webm")) return "webm";
  if (contentType.includes("x-matroska")) return "mkv";
  return "mp4";
}
