import fsp from "node:fs/promises";
import fs from "node:fs";
import path from "node:path";
import type { ByteRange, ObjectStream, StorageAdapter } from "./types";

export class LocalStorageAdapter implements StorageAdapter {
  constructor(private readonly root: string) {}

  private resolve(key: string): string {
    const resolved = path.resolve(this.root, key);
    if (!resolved.startsWith(path.resolve(this.root))) {
      throw new Error(`Refusing to resolve storage key outside root: ${key}`);
    }
    return resolved;
  }

  async putFile(key: string, localPath: string): Promise<void> {
    const dest = this.resolve(key);
    await fsp.mkdir(path.dirname(dest), { recursive: true });
    await fsp.copyFile(localPath, dest);
  }

  async withLocalFile<T>(key: string, fn: (localPath: string) => Promise<T>): Promise<T> {
    return fn(this.resolve(key));
  }

  async getObjectStream(key: string, range?: ByteRange): Promise<ObjectStream> {
    const filePath = this.resolve(key);
    const { size } = await fsp.stat(filePath);

    if (!range) {
      return { stream: fs.createReadStream(filePath), contentLength: size, totalSize: size };
    }

    const end = Math.min(range.end, size - 1);
    return {
      stream: fs.createReadStream(filePath, { start: range.start, end }),
      contentLength: end - range.start + 1,
      totalSize: size,
    };
  }

  async exists(key: string): Promise<boolean> {
    try {
      await fsp.access(this.resolve(key));
      return true;
    } catch {
      return false;
    }
  }

  async getUploadUrl(): Promise<string | null> {
    return null;
  }

  async getPublicUrl(): Promise<string | null> {
    return null;
  }
}
