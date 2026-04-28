// Clean Vite config — no Cloudflare adapter so the build produces a
// Node-compatible SSR bundle at `.output/server/index.mjs`, ready
// to be run with `node .output/server/index.mjs` inside Docker.
import { fileURLToPath, URL } from "node:url";

import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [
    tailwindcss(),
    tanstackStart(),
    react(),
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    port: 8080,
    host: true,
    strictPort: false,
  },
});
