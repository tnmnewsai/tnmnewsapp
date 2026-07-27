import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { startAssetServer } from "./asset-server";
import type { CaptionWord, ClipCompositionProps, OverlayInput, TemplateConfig } from "../remotion/types";

export type { CaptionWord, OverlayInput, TemplateConfig } from "../remotion/types";

let bundlePromise: Promise<string> | undefined;

/** Bundled once per worker process lifetime and reused — webpack-bundling on every render would be wasteful. */
function getBundleLocation(): Promise<string> {
  if (!bundlePromise) {
    bundlePromise = bundle({ entryPoint: path.join(__dirname, "..", "remotion", "index.ts") });
  }
  return bundlePromise;
}

export interface BrandedOverlayInput extends Omit<OverlayInput, "imageSrc"> {
  /** Local path — copied into the render's temp asset-serve directory. */
  imagePath?: string;
}

export interface BrandedTemplateInput extends Omit<TemplateConfig, "logoSrc"> {
  logoPath?: string;
}

export interface RenderBrandedClipInput {
  /** Local path to the already-cut clip (output of `cutClip`). */
  sourceVideoPath: string;
  durationMs: number;
  width: number;
  height: number;
  fps?: number;
  captionWords: CaptionWord[];
  overlays: BrandedOverlayInput[];
  template: BrandedTemplateInput | null;
  musicPath?: string;
  musicVolume?: number;
  outputPath: string;
}

export async function renderBrandedClip(input: RenderBrandedClipInput): Promise<void> {
  const fps = input.fps ?? 30;
  const serveDir = fs.mkdtempSync(path.join(os.tmpdir(), "svt-remotion-assets-"));

  try {
    fs.copyFileSync(input.sourceVideoPath, path.join(serveDir, "video.mp4"));

    const overlayAssets: OverlayInput[] = input.overlays.map((o, i) => {
      if (o.type !== "image" || !o.imagePath) {
        return { type: o.type, text: o.text, position: o.position, startMs: o.startMs, endMs: o.endMs };
      }
      const filename = `overlay-${i}${path.extname(o.imagePath) || ".png"}`;
      fs.copyFileSync(o.imagePath, path.join(serveDir, filename));
      return { type: o.type, position: o.position, startMs: o.startMs, endMs: o.endMs, imageSrc: filename };
    });

    let templateConfig: TemplateConfig | null = null;
    if (input.template) {
      let logoSrc: string | undefined;
      if (input.template.logoPath) {
        const logoFilename = `logo${path.extname(input.template.logoPath) || ".png"}`;
        fs.copyFileSync(input.template.logoPath, path.join(serveDir, logoFilename));
        logoSrc = logoFilename;
      }
      const { logoPath: _logoPath, ...rest } = input.template;
      templateConfig = { ...rest, logoSrc };
    }

    let musicFilename: string | undefined;
    if (input.musicPath) {
      musicFilename = `music${path.extname(input.musicPath) || ".mp3"}`;
      fs.copyFileSync(input.musicPath, path.join(serveDir, musicFilename));
    }

    const assetServer = await startAssetServer(serveDir);
    try {
      const props: ClipCompositionProps = {
        videoSrc: `${assetServer.baseUrl}/video.mp4`,
        durationInFrames: Math.round((input.durationMs / 1000) * fps),
        fps,
        width: input.width,
        height: input.height,
        captionWords: input.captionWords,
        overlays: overlayAssets.map((o) => ({
          ...o,
          imageSrc: o.imageSrc ? `${assetServer.baseUrl}/${o.imageSrc}` : undefined,
        })),
        template: templateConfig
          ? { ...templateConfig, logoSrc: templateConfig.logoSrc ? `${assetServer.baseUrl}/${templateConfig.logoSrc}` : undefined }
          : null,
        musicSrc: musicFilename ? `${assetServer.baseUrl}/${musicFilename}` : undefined,
        musicVolume: input.musicVolume,
      };

      const serveUrl = await getBundleLocation();
      const composition = await selectComposition({ serveUrl, id: "ClipComposition", inputProps: props });
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
