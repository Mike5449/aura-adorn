// ---------------------------------------------------------------
// Carat & Couleur — Node SSR runner
//
// TanStack Start emits a fetch-style handler at dist/server/server.js
// (web standards, like Cloudflare/Vercel). It does NOT call .listen()
// itself. We wrap it with @hono/node-server so Node binds a real
// HTTP server on PORT/HOST.
// ---------------------------------------------------------------
import { serve } from "@hono/node-server";
import handler from "./dist/server/server.js";

const port = Number(process.env.PORT || process.env.NITRO_PORT || 3000);
const hostname = process.env.HOST || process.env.NITRO_HOST || "0.0.0.0";

if (!handler || typeof handler.fetch !== "function") {
  console.error(
    "Bundle does not export a default { fetch } handler. " +
      "Got:",
    handler,
  );
  process.exit(1);
}

const fetchHandler = (request) => handler.fetch(request);

serve(
  {
    fetch: fetchHandler,
    port,
    hostname,
  },
  (info) => {
    console.log(
      `✔ Carat & Couleur web ready on http://${info.address ?? hostname}:${info.port}`,
    );
  },
);

// Graceful shutdown so Docker stops the container cleanly
const shutdown = (signal) => {
  console.log(`Received ${signal}, shutting down…`);
  process.exit(0);
};
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
