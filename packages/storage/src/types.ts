export interface ByteRange {
  start: number;
  end: number;
}

export interface ObjectStream {
  stream: NodeJS.ReadableStream;
  /** Bytes in this stream (the whole object, or just the requested range). */
  contentLength: number;
  /** Total object size — always the full size, even for a ranged request. */
  totalSize: number;
}

export interface StorageAdapter {
  /** Copy a local file into storage under `key`. */
  putFile(key: string, localPath: string, contentType?: string): Promise<void>;
  /**
   * Guarantee the object is available as a local file for the duration of
   * `fn`, then clean up any temp copy. Local driver just hands back the real
   * path; the S3 driver downloads to a temp file first. Use this for
   * whole-file processing (ffmpeg, transcription) — NOT for serving an HTTP
   * response, since the temp file is removed as soon as `fn` returns, which
   * happens before a streamed response body finishes being read.
   */
  withLocalFile<T>(key: string, fn: (localPath: string) => Promise<T>): Promise<T>;
  /** Streams the object (optionally a byte range) for serving directly over HTTP. */
  getObjectStream(key: string, range?: ByteRange): Promise<ObjectStream>;
  exists(key: string): Promise<boolean>;
  /** Presigned browser upload URL when the backing store is internet-reachable. */
  getUploadUrl(key: string, contentType: string, expiresInSeconds?: number): Promise<string | null>;
  /**
   * A URL a third party (e.g. Meta's servers, fetching `video_url` for
   * Instagram content publishing) can fetch directly, with no auth of ours
   * required. The S3/R2 driver presigns one; local storage returns null —
   * it isn't internet-reachable, so callers that need this must handle null.
   */
  getPublicUrl(key: string, expiresInSeconds?: number): Promise<string | null>;
}
