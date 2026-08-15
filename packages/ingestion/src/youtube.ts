import fs from "node:fs";
import path from "node:path";
import ffmpegPath from "ffmpeg-static";
import { getYtDlp } from "./binary";
import { assertHasVideoStream } from "./validate-media";
import type { FetchedMedia } from "./types";

export async function fetchYouTubeVideo(url: string, destDir: string): Promise<FetchedMedia> {
  fs.mkdirSync(destDir, { recursive: true });
  const ytDlp = await getYtDlp();
  const cookiesFile = process.env.YOUTUBE_COOKIES_FILE?.trim();
  const authArgs = cookiesFile ? ["--cookies", cookiesFile] : [];
  const runtimeArgs =
    process.platform === "win32"
      ? ["--js-runtimes", "node"]
      : ["--js-runtimes", "node:/usr/bin/node"];

  let infoRaw: unknown;
  try {
    infoRaw = await ytDlp.getVideoInfo([url, ...authArgs, ...runtimeArgs]);
  } catch (error) {
    throw friendlyYouTubeError(error, Boolean(cookiesFile));
  }
  const info = infoRaw as { title?: string; duration?: number };

  const outputTemplate = path.join(destDir, "source.%(ext)s");
  try {
    await ytDlp.execPromise([
      url,
      ...authArgs,
      ...runtimeArgs,
      "-f",
      "bv*+ba/b",
      "--merge-output-format",
      "mp4",
      // Without this, yt-dlp can't find an ffmpeg to merge separate
      // video+audio streams and silently falls back to an audio-only format.
      "--ffmpeg-location",
      ffmpegPath as string,
      "--no-playlist",
      "-o",
      outputTemplate,
    ]);
  } catch (error) {
    throw friendlyYouTubeError(error, Boolean(cookiesFile));
  }

  const files = fs.readdirSync(destDir).filter((f) => f.startsWith("source."));
  const file = files[0];
  if (!file) throw new Error(`yt-dlp reported success but no output file was found in ${destDir}`);

  const localPath = path.join(destDir, file);
  await assertHasVideoStream(localPath);

  const ext = path.extname(file).replace(".", "");
  return {
    localPath,
    ext,
    originalFilename: info.title ? `${info.title}.${ext}` : file,
    durationMs: typeof info.duration === "number" ? Math.round(info.duration * 1000) : undefined,
  };
}

function friendlyYouTubeError(error: unknown, cookiesConfigured: boolean): Error {
  const message = error instanceof Error ? error.message : String(error);
  if (
    message.includes("Sign in to confirm you’re not a bot") ||
    message.includes("Sign in to confirm you're not a bot")
  ) {
    return new Error(
      cookiesConfigured
        ? "YouTube rejected the saved browser session. Export a fresh YouTube cookies.txt file and try again."
        : "YouTube requires an authenticated browser session for downloads from this server. Configure YOUTUBE_COOKIES_FILE on the worker.",
    );
  }
  return error instanceof Error ? error : new Error("YouTube download failed.");
}
