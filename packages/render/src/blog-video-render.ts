import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { startAssetServer } from "./asset-server";
import type { BlogVideoCompositionProps, BlogVideoSegment } from "../remotion/types";

let bundlePromise: Promise<string> | undefined;

/** Same bundle/entry as branded-render.ts and thumbnail-render.ts — one Root registers all compositions. */
function getBundleLocation(): Promise<string> {
  if (!bundlePromise) {
    bundlePromise = bundle({ entryPoint: path.join(__dirname, "..", "remotion", "index.ts") });
  }
  return bundlePromise;
}

export interface RenderBlogVideoSegmentInput {
  /** Local path to this segment's AI-generated image. */
  imagePath: string;
  /** This segment's real TTS clip duration — drives how long the image is shown. */
  durationMs: number;
}

export interface RenderBlogVideoInput {
  /** Local path to the full concatenated narration track. */
  audioPath: string;
  segments: RenderBlogVideoSegmentInput[];
  width: number;
  height: number;
  fps?: number;
  outputPath: string;
}

export async function renderBlogVideo(input: RenderBlogVideoInput): Promise<void> {
  const fps = input.fps ?? 30;
  const serveDir = fs.mkdtempSync(path.join(os.tmpdir(), "svt-remotion-blog-"));

  try {
    const audioFilename = `narration${path.extname(input.audioPath) || ".mp3"}`;
    fs.copyFileSync(input.audioPath, path.join(serveDir, audioFilename));

    let cursorMs = 0;
    const segments: BlogVideoSegment[] = input.segments.map((s, i) => {
      const filename = `segment-${i}${path.extname(s.imagePath) || ".jpg"}`;
      fs.copyFileSync(s.imagePath, path.join(serveDir, filename));
      const seg: BlogVideoSegment = { imageSrc: filename, startMs: cursorMs, endMs: cursorMs + s.durationMs };
      cursorMs += s.durationMs;
      return seg;
    });
    const totalDurationMs = cursorMs;

    const assetServer = await startAssetServer(serveDir);
    try {
      const props: BlogVideoCompositionProps = {
        durationInFrames: Math.max(1, Math.round((totalDurationMs / 1000) * fps)),
        fps,
        width: input.width,
        height: input.height,
        audioSrc: `${assetServer.baseUrl}/${audioFilename}`,
        segments: segments.map((s) => ({ ...s, imageSrc: `${assetServer.baseUrl}/${s.imageSrc}` })),
      };

      const serveUrl = await getBundleLocation();
      const composition = await selectComposition({
        serveUrl,
        id: "BlogVideoComposition",
        inputProps: props,
      });
      await renderMedia({
        composition,
        serveUrl,
        codec: "h264",
        outputLocation: input.outputPath,
        inputProps: props,
      });
    } finally {
      await assetServer.close();
    }
  } finally {
    fs.rmSync(serveDir, { recursive: true, force: true });
  }
}
