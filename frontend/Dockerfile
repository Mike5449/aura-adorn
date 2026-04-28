# syntax=docker/dockerfile:1.7
# ----------------------------------------------------------------
# Frontend — TanStack Start app, served as a Node SSR runtime.
#
# TanStack Start with the default Nitro preset builds to:
#   .output/server/index.mjs  → Node entry point
#   .output/public/           → static assets (no standalone index.html)
#
# So we run the bundle with Node. An external nginx (declared in the
# repo-root docker-compose.yml) handles TLS / domain routing and
# proxies /api + /media to the backend.
# ----------------------------------------------------------------

FROM node:20-alpine AS build
WORKDIR /app

# Native build deps for some npm packages on Alpine
RUN apk add --no-cache python3 make g++

COPY package.json package-lock.json* bun.lockb* bunfig.toml* ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

COPY . .

# API base URL injected at build time. Default = same-origin /api,
# which the front nginx proxy forwards to the backend container.
ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL

# Each build step is its own RUN so failures stop on the right line
RUN npm run build
RUN echo "=== build artifacts ===" && ls -la
RUN echo "=== dist/client ===" && (test -d dist/client && ls -la dist/client || echo "(no dist/client)")
RUN echo "=== dist/server ===" && (test -d dist/server && ls -la dist/server || echo "(no dist/server)")
# Try common TanStack Start / Nitro server entry points and symlink to a stable path
RUN set -e; \
    if   [ -f dist/server/server.js ];   then ln -sf server/server.js   dist/_entry; \
    elif [ -f dist/server/index.mjs ];   then ln -sf server/index.mjs   dist/_entry; \
    elif [ -f dist/server/server.mjs ];  then ln -sf server/server.mjs  dist/_entry; \
    elif [ -f dist/server/main.mjs ];    then ln -sf server/main.mjs    dist/_entry; \
    elif [ -f dist/server/index.js ];    then ln -sf server/index.js    dist/_entry; \
    elif [ -f .output/server/index.mjs ]; then mv .output dist-output && ln -sf ../dist-output/server/index.mjs dist/_entry; \
    else echo "ERROR: no server entry found in dist/server"; ls -la dist/server; exit 1; fi

# ----------------------------------------------------------------
# Runtime — minimal Node image
# ----------------------------------------------------------------
FROM node:20-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000 \
    NITRO_HOST=0.0.0.0 \
    NITRO_PORT=3000

# Copy the built server + client assets, package.json, and node_modules.
# TanStack Start emits a Node bundle that keeps several runtime deps
# (h3, h3-v2, …) external — they need to be resolvable at startup.
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules

EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
    CMD wget -q --spider http://localhost:3000/ || exit 1

# `dist/_entry` is a symlink the build stage points at whichever
# server entry TanStack Start emitted (server.js, index.mjs, …).
CMD ["node", "dist/_entry"]
