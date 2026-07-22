import fs from "node:fs/promises";
import path from "node:path";
import type { StorageAdapter } from "./types";

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
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.copyFile(localPath, dest);
  }

  async withLocalFile<T>(key: string, fn: (localPath: string) => Promise<T>): Promise<T> {
    return fn(this.resolve(key));
  }

  async exists(key: string): Promise<boolean> {
    try {
      await fs.access(this.resolve(key));
      return true;
    } catch {
      return false;
    }
  }
}
