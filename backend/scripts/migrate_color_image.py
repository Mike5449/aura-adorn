"""
Adds product_colors.image_url so each colour variant can show its own
photo on the storefront. Idempotent — safe to re-run.
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
    cur.execute(
        "ALTER TABLE product_colors ADD COLUMN IF NOT EXISTS image_url VARCHAR(500)"
    )
    print("[OK] product_colors.image_url ready")
    cur.close()
    conn.close()


if __name__ == "__main__":
    run()
