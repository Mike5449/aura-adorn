// ---------------------------------------------------------------
// Beauté & Élégance — Node SSR runner
//
// TanStack Start emits a fetch-style handler at dist/server/server.js
// (web standards, like Cloudflare/Vercel). We:
//   1. serve static client assets from dist/client/ ourselves
//      (TanStack expects a CDN to do this — there isn't one here),
//   2. fall back to the bundle's fetch() for SSR / API routes,
//   3. wrap everything in @hono/node-server's serve() so we get a
//      real Node http.createServer().listen(PORT, HOST).
// ---------------------------------------------------------------
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

import { serve } from "@hono/node-server";

import handler from "./dist/server/server.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const CLIENT_DIR = join(__dirname, "dist", "client");

const MIME = {
  ".html":  "text/html; charset=utf-8",
  ".js":    "application/javascript; charset=utf-8",
  ".mjs":   "application/javascript; charset=utf-8",
  ".css":   "text/css; charset=utf-8",
  ".json":  "application/json; charset=utf-8",
  ".map":   "application/json; charset=utf-8",
  ".svg":   "image/svg+xml",
  ".png":   "image/png",
  ".jpg":   "image/jpeg",
  ".jpeg":  "image/jpeg",
  ".gif":   "image/gif",
  ".webp":  "image/webp",
  ".ico":   "image/x-icon",
  ".woff":  "font/woff",
  ".woff2": "font/woff2",
  ".ttf":   "font/ttf",
  ".otf":   "font/otf",
  ".txt":   "text/plain; charset=utf-8",
};

async function serveStaticFile(pathname) {
  // Prevent directory traversal
  const safePath = normalize(pathname).replace(/^(\.\.[\/\\])+/, "");
  const filePath = join(CLIENT_DIR, safePath);
  if (!filePath.startsWith(CLIENT_DIR)) return null;

  try {
    const s = await stat(filePath);
    if (!s.isFile()) return null;
    const buf = await readFile(filePath);
    const type = MIME[extname(filePath).toLowerCase()] || "application/octet-stream";
    const isHashed = /\.[A-Za-z0-9]{8,}\.\w+$/.test(filePath);
    return new Response(buf, {
      headers: {
        "Content-Type": type,
        "Cache-Control": isHashed
          ? "public, max-age=31536000, immutable"
          : "public, max-age=3600",
      },
    });
  } catch {
    return null;
  }
}

if (!handler || typeof handler.fetch !== "function") {
  console.error("Bundle does not export a default { fetch } handler. Got:", handler);
  process.exit(1);
}

async function combinedFetch(request) {
  const url = new URL(request.url);
  const p = url.pathname;

  // Try to serve static assets first
  if (
    p.startsWith("/_build/") ||
    p.startsWith("/assets/") ||
    p === "/favicon.ico" ||
    p === "/robots.txt" ||
    p === "/sitemap.xml"
  ) {
    const file = await serveStaticFile(p);
    if (file) return file;
  }

  // Fall through to the SSR / API handler
  return handler.fetch(request);
}

const port = Number(process.env.PORT || process.env.NITRO_PORT || 3000);
const hostname = process.env.HOST || process.env.NITRO_HOST || "0.0.0.0";

serve(
  { fetch: combinedFetch, port, hostname },
  (info) => {
    console.log(
      `✔ Beauté & Élégance web ready on http://${info.address ?? hostname}:${info.port}`,
    );
    console.log(`  static dir: ${CLIENT_DIR}`);
  },
);

const shutdown = (signal) => {
  console.log(`Received ${signal}, shutting down…`);
  process.exit(0);
};
process.on("SIGINT",  () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
