import { Readable } from "node:stream";
import type { NextRequest } from "next/server";
import { getStorage } from "@svt/storage";

const MIME_BY_EXT: Record<string, string> = {
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  mkv: "video/x-matroska",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
};

/** Shared by every storage-backed streaming route (video/audio/image) — Range-enabled. */
export async function streamStorageObject(req: NextRequest, storageKey: string): Promise<Response> {
  const ext = storageKey.split(".").pop() ?? "mp4";
  const contentType = MIME_BY_EXT[ext] ?? "application/octet-stream";

  const rangeHeader = req.headers.get("range");
  const match = rangeHeader ? /bytes=(\d*)-(\d*)/.exec(rangeHeader) : null;
  const range =
    match && (match[1] || match[2])
      ? {
          start: match[1] ? parseInt(match[1], 10) : 0,
          end: match[2] ? parseInt(match[2], 10) : Infinity,
        }
      : undefined;

  const object = await getStorage().getObjectStream(
    storageKey,
    range
      ? { start: range.start, end: range.end === Infinity ? Number.MAX_SAFE_INTEGER : range.end }
      : undefined,
  );
  const webStream = Readable.toWeb(object.stream as Readable) as unknown as ReadableStream;

  if (!range) {
    return new Response(webStream, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(object.contentLength),
        "Accept-Ranges": "bytes",
      },
    });
  }

  const end = Math.min(range.end, object.totalSize - 1);
  return new Response(webStream, {
    status: 206,
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(object.contentLength),
      "Content-Range": `bytes ${range.start}-${end}/${object.totalSize}`,
      "Accept-Ranges": "bytes",
    },
  });
}
