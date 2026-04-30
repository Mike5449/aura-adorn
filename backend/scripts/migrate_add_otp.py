"""
Adds the otp_challenges table for the admin two-factor login flow.

Idempotent — safe to re-run. Used only when the FastAPI lifespan's
Base.metadata.create_all() hasn't run yet (e.g. running migrations
manually before the server starts on a fresh deploy).
"""
from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import psycopg2
from urllib.parse import urlparse

from core.config import settings


def _connect():
    url = urlparse(settings.DATABASE_URL.replace("postgresql+psycopg2://", "postgresql://"))
    return psycopg2.connect(
        host=url.hostname,
        port=url.port or 5432,
        user=url.username,
        password=url.password,
        dbname=(url.path or "/postgres").lstrip("/"),
    )


def run() -> None:
    conn = _connect()
    conn.autocommit = True
    cur = conn.cursor()

    print("=== otp_challenges ===")
    cur.execute("""
        CREATE TABLE IF NOT EXISTS otp_challenges (
            id            VARCHAR(64) PRIMARY KEY,
            user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            code_hash     VARCHAR(255) NOT NULL,
            expires_at    TIMESTAMPTZ NOT NULL,
            attempts      INTEGER NOT NULL DEFAULT 0,
            last_sent_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """)
    cur.execute(
        "CREATE INDEX IF NOT EXISTS ix_otp_challenges_user_id ON otp_challenges(user_id)"
    )
    print("  [OK] table + index ready")

    cur.close()
    conn.close()
    print("=== Done ===")


if __name__ == "__main__":
    run()
