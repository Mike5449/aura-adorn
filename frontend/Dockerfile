# syntax=docker/dockerfile:1.7
# ----------------------------------------------------------------
# Stage 1 — build the Vite app
# ----------------------------------------------------------------
FROM node:20-alpine AS build

WORKDIR /app

# Native build tools (some Tailwind / lucide deps need them on alpine)
RUN apk add --no-cache python3 make g++

COPY package.json package-lock.json* bun.lockb* bunfig.toml* ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

COPY . .

# Public API base URL exposed at build time. By default we use the
# same-origin path `/api` because nginx proxies it to the backend
# inside docker-compose. Override with --build-arg if you serve
# the API on a different host.
ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

# Vite + TanStack Start can output to several places depending on
# config. We normalise everything into /out so the runtime stage
# is agnostic.
RUN set -e; \
    if [ -d ".output/public" ]; then mv .output/public /out; \
    elif [ -d "dist/client" ]; then mv dist/client /out; \
    elif [ -d "dist" ]; then mv dist /out; \
    else echo "No build output found"; ls -la; exit 1; fi

# ----------------------------------------------------------------
# Stage 2 — serve static files + proxy /api to backend
# ----------------------------------------------------------------
FROM nginx:alpine

# Larger uploads (image upload from admin)
RUN sed -i 's|client_max_body_size .*;|client_max_body_size 10M;|' /etc/nginx/nginx.conf || true

COPY --from=build /out /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=15s --timeout=5s --retries=5 \
    CMD wget --quiet --spider http://localhost/ || exit 1
