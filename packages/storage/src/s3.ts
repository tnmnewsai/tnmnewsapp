import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import type { StorageAdapter } from "./types";

export interface S3StorageConfig {
  bucket: string;
  region: string;
  endpoint?: string; // set for R2 / other S3-compatible providers
  accessKeyId: string;
  secretAccessKey: string;
}

export class S3StorageAdapter implements StorageAdapter {
  private readonly client: S3Client;

  constructor(private readonly config: S3StorageConfig) {
    this.client = new S3Client({
      region: config.region,
      endpoint: config.endpoint,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  }

  async putFile(key: string, localPath: string, contentType?: string): Promise<void> {
    const body = fs.readFileSync(localPath);
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
  }

  async withLocalFile<T>(key: string, fn: (localPath: string) => Promise<T>): Promise<T> {
    const tempPath = path.join(os.tmpdir(), `svt-${Date.now()}-${path.basename(key)}`);
    const response = await this.client.send(
      new GetObjectCommand({ Bucket: this.config.bucket, Key: key }),
    );
    const body = response.Body;
    if (!body) throw new Error(`No body returned for storage key: ${key}`);

    await new Promise<void>((resolve, reject) => {
      const writeStream = fs.createWriteStream(tempPath);
      (body as NodeJS.ReadableStream).pipe(writeStream).on("finish", resolve).on("error", reject);
    });

    try {
      return await fn(tempPath);
    } finally {
      fs.rmSync(tempPath, { force: true });
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: this.config.bucket, Key: key }));
      return true;
    } catch {
      return false;
    }
  }
}
