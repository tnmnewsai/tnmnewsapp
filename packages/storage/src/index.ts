import path from "node:path";
import { LocalStorageAdapter } from "./local";
import { S3StorageAdapter } from "./s3";
import type { StorageAdapter } from "./types";

export type { StorageAdapter } from "./types";

let cached: StorageAdapter | undefined;

/**
 * STORAGE_DRIVER=local (default) stores under STORAGE_LOCAL_ROOT — set the
 * same absolute path in every app's .env so they share one storage tree.
 * STORAGE_DRIVER=s3 talks to any S3-compatible bucket (AWS S3 or R2 via
 * S3_ENDPOINT).
 */
export function getStorage(): StorageAdapter {
  if (cached) return cached;

  const driver = process.env.STORAGE_DRIVER ?? "local";

  if (driver === "s3") {
    cached = new S3StorageAdapter({
      bucket: requireEnv("S3_BUCKET"),
      region: process.env.S3_REGION ?? "auto",
      endpoint: process.env.S3_ENDPOINT,
      accessKeyId: requireEnv("S3_ACCESS_KEY_ID"),
      secretAccessKey: requireEnv("S3_SECRET_ACCESS_KEY"),
    });
    return cached;
  }

  const root = process.env.STORAGE_LOCAL_ROOT ?? path.resolve(process.cwd(), ".data/storage");
  cached = new LocalStorageAdapter(root);
  return cached;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

export function sourceAssetStorageKey(brandId: string, sourceAssetId: string, ext: string): string {
  return `brands/${brandId}/source-assets/${sourceAssetId}/original.${ext}`;
}
