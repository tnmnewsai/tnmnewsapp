import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import { startAssetServer } from "./asset-server";
import type { ThumbnailCompositionProps } from "../remotion/types";

let bundlePromise: Promise<string> | undefined;

/** Shared with branded-render.ts's bundle in spirit, but a separate cache — both entry the same `remotion/index.ts` root, which registers both compositions. */
function getBundleLocation(): Promise<string> {
  if (!bundlePromise) {
    bundlePromise = bundle({ entryPoint: path.join(__dirname, "..", "remotion", "index.ts") });
  }
  return bundlePromise;
}

export interface RenderThumbnailInput {
  /** Local path to the base image — an extracted frame or a custom GraphicAsset. */
  baseImagePath: string;
  width: number;
  height: number;
  titleText: string;
  descriptionText: string;
  accentColor?: string;
  outputPath: string;
}

export async function renderThumbnail(input: RenderThumbnailInput): Promise<void> {
  const serveDir = fs.mkdtempSync(path.join(os.tmpdir(), "svt-remotion-thumb-"));

  try {
    const filename = `base${path.extname(input.baseImagePath) || ".png"}`;
    fs.copyFileSync(input.baseImagePath, path.join(serveDir, filename));

    const assetServer = await startAssetServer(serveDir);
    try {
      const props: ThumbnailCompositionProps = {
        width: input.width,
        height: input.height,
        baseImageSrc: `${assetServer.baseUrl}/${filename}`,
        titleText: input.titleText,
        descriptionText: input.descriptionText,
        accentColor: input.accentColor ?? "#f97316",
      };

      const serveUrl = await getBundleLocation();
      const composition = await selectComposition({
        serveUrl,
        id: "ThumbnailComposition",
        inputProps: props,
      });
      await renderStill({
        composition,
        serveUrl,
        output: input.outputPath,
        inputProps: props,
      });
    } finally {
      await assetServer.close();
    }
  } finally {
    fs.rmSync(serveDir, { recursive: true, force: true });
  }
}
