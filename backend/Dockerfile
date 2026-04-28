# syntax=docker/dockerfile:1.7
FROM python:3.12-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# Install runtime libs (libpq5 — needed by psycopg2 at runtime, curl
# for the healthcheck) and build deps in one layer. We then install
# the Python wheels and finally drop the build deps to keep the
# image small. libpq5 stays so psycopg2 can connect to Postgres.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        build-essential libpq-dev libpq5 curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Drop build-time deps but keep libpq5 + curl
RUN apt-get purge -y --auto-remove build-essential libpq-dev \
    && apt-get clean

COPY . .

# Persist uploaded media outside the image
RUN mkdir -p /app/uploads
VOLUME ["/app/uploads"]

EXPOSE 8000

# Healthcheck so docker-compose can wait on it
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
    CMD curl -fsS http://localhost:8000/health || exit 1

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers", "--forwarded-allow-ips=*"]
