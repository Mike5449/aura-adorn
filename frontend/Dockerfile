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
# Use `npm install` (not `npm ci`) so newly-added deps that aren't yet
# in package-lock.json (e.g. @hono/node-server) install cleanly.
RUN npm install --no-audit --no-fund --no-progress

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
RUN test -f dist/server/server.js \
    || (echo "ERROR: dist/server/server.js missing"; ls -la dist/server; exit 1)

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

# Copy the built server + client assets, package.json, node_modules,
# and our small Node runner that wraps the fetch-style server bundle
# emitted by TanStack Start with @hono/node-server.
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/server-runner.mjs ./

EXPOSE 3000

# Healthcheck — `wget --spider` issues a HEAD request that the
# @hono/node-server fetch handler doesn't always answer with 2xx, which
# leaves the container marked `unhealthy` even when Node is serving
# normally. Use a real GET, throw away the body, and only the connection
# + status code matter.
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
    CMD wget -q -O /dev/null http://localhost:3000/ || exit 1

CMD ["node", "server-runner.mjs"]
