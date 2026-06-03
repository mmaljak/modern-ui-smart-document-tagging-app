import { existsSync, readFileSync, statSync } from "fs";
import { join, extname } from "path";
import { fileURLToPath } from "url";
import ssrHandler from "./dist/server/server.js";

const rootDir = fileURLToPath(new URL(".", import.meta.url));
const clientDir = join(rootDir, "dist", "client");

const MIME = {
  ".js": "application/javascript",
  ".css": "text/css",
  ".html": "text/html",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".ttf": "font/ttf",
  ".json": "application/json",
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const filePath = join(clientDir, url.pathname);

    try {
      const stat = statSync(filePath);
      if (stat.isFile()) {
        const ext = extname(filePath);
        const isImmutable = url.pathname.startsWith("/assets/");
        return new Response(readFileSync(filePath), {
          headers: {
            "Content-Type": MIME[ext] ?? "application/octet-stream",
            "Cache-Control": isImmutable
              ? "public, max-age=31536000, immutable"
              : "no-cache",
          },
        });
      }
    } catch {
      // Not a static file — fall through to SSR
    }

    return ssrHandler.fetch(request, env, ctx);
  },
};
