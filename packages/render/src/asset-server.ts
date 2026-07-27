import fs from "node:fs";
import http from "node:http";
import path from "node:path";

export interface AssetServer {
  baseUrl: string;
  close: () => Promise<void>;
}

const MIME_BY_EXT: Record<string, string> = {
  ".mp4": "video/mp4",
  ".mp3": "audio/mpeg",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
};

/**
 * Serves a temp directory over HTTP on an ephemeral local port. Remotion's
 * headless Chromium renders `<Video>`/`<Img>`/`<Audio>` elements as a normal
 * browser would — real HTTP is the robust way to feed it dynamic,
 * non-bundled assets, rather than relying on `file://` URLs working the same
 * way media elements expect. Range support is required, not optional:
 * Chromium's `<video>` probes duration/metadata with a ranged request, and
 * without a 206 response it hangs until Remotion's delayRender times out.
 */
export function startAssetServer(rootDir: string): Promise<AssetServer> {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const urlPath = decodeURIComponent((req.url ?? "/").split("?")[0] ?? "/");
      const filePath = path.join(rootDir, urlPath);
      if (!filePath.startsWith(path.resolve(rootDir))) {
        res.writeHead(403);
        res.end();
        return;
      }

      fs.stat(filePath, (err, stat) => {
        if (err || !stat.isFile()) {
          res.writeHead(404);
          res.end();
          return;
        }

        const contentType = MIME_BY_EXT[path.extname(filePath)] ?? "application/octet-stream";
        const rangeHeader = req.headers.range;
        const match = rangeHeader ? /bytes=(\d*)-(\d*)/.exec(rangeHeader) : null;

        if (req.method === "HEAD") {
          res.writeHead(200, {
            "Content-Length": stat.size,
            "Content-Type": contentType,
            "Accept-Ranges": "bytes",
          });
          res.end();
          return;
        }

        if (!match) {
          res.writeHead(200, {
            "Content-Length": stat.size,
            "Content-Type": contentType,
            "Accept-Ranges": "bytes",
          });
          fs.createReadStream(filePath).pipe(res);
          return;
        }

        const start = match[1] ? parseInt(match[1], 10) : 0;
        const end = match[2] ? parseInt(match[2], 10) : stat.size - 1;
        res.writeHead(206, {
          "Content-Length": end - start + 1,
          "Content-Type": contentType,
          "Content-Range": `bytes ${start}-${end}/${stat.size}`,
          "Accept-Ranges": "bytes",
        });
        fs.createReadStream(filePath, { start, end }).pipe(res);
      });
    });

    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      resolve({
        baseUrl: `http://127.0.0.1:${port}`,
        close: () => new Promise((res) => server.close(() => res())),
      });
    });
  });
}
