export interface StorageAdapter {
  /** Copy a local file into storage under `key`. */
  putFile(key: string, localPath: string, contentType?: string): Promise<void>;
  /**
   * Guarantee the object is available as a local file for the duration of
   * `fn`, then clean up any temp copy. Local driver just hands back the real
   * path; the S3 driver downloads to a temp file first.
   */
  withLocalFile<T>(key: string, fn: (localPath: string) => Promise<T>): Promise<T>;
  exists(key: string): Promise<boolean>;
}
