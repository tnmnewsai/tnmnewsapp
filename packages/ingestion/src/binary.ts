import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import YTDlpWrap from "yt-dlp-wrap";

const BIN_DIR = path.join(os.tmpdir(), "svt-bin");
const BIN_PATH = path.join(BIN_DIR, process.platform === "win32" ? "yt-dlp.exe" : "yt-dlp");

let wrapPromise: Promise<InstanceType<typeof YTDlpWrap>> | undefined;

/** Downloads the yt-dlp binary once (cached under the OS temp dir) and reuses it after. */
export function getYtDlp(): Promise<InstanceType<typeof YTDlpWrap>> {
  if (!wrapPromise) {
    wrapPromise = (async () => {
      if (!fs.existsSync(BIN_PATH)) {
        fs.mkdirSync(BIN_DIR, { recursive: true });
        await YTDlpWrap.downloadFromGithub(BIN_PATH);
      }
      return new YTDlpWrap(BIN_PATH);
    })();
  }
  return wrapPromise;
}
