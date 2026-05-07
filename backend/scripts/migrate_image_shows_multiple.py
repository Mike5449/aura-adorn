"""
Adds products.image_shows_multiple — boolean opted-in per product by the
admin. When true, the storefront tags the price with "/ unité" so the
customer doesn't read the photo of multiple stacked items as the price
of the bundle. Default off so existing products keep their plain price.

Idempotent — safe to re-run.
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
        "ALTER TABLE products ADD COLUMN IF NOT EXISTS image_shows_multiple "
        "BOOLEAN NOT NULL DEFAULT FALSE"
    )
    print("[OK] products.image_shows_multiple ready")
    cur.close()
    conn.close()


if __name__ == "__main__":
    run()
