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

RUN npm run build \
    && echo "=== build artifacts ===" \
    && ls -la \
    && (test -d .output && ls -la .output) \
    && (test -f .output/server/index.mjs \
        || (echo "ERROR: TanStack Start did not emit .output/server/index.mjs"; exit 1))

# ----------------------------------------------------------------
# Runtime — minimal Node image
# ----------------------------------------------------------------
FROM node:20-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000

# Copy the built server + public assets
COPY --from=build /app/.output ./.output
COPY --from=build /app/package.json ./

EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
    CMD wget -q --spider http://localhost:3000/ || exit 1

CMD ["node", ".output/server/index.mjs"]
