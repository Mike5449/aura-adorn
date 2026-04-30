"""
Adds order_items.image_url and back-fills it for existing rows from
products.image_url where the link is still alive.

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

    print("=== order_items.image_url ===")
    cur.execute(
        "ALTER TABLE order_items ADD COLUMN IF NOT EXISTS image_url VARCHAR(500)"
    )
    print("  [OK] column ready")

    print("\n=== back-fill from products ===")
    cur.execute("""
        UPDATE order_items oi
        SET image_url = p.image_url
        FROM products p
        WHERE oi.product_id = p.id AND oi.image_url IS NULL
    """)
    print(f"  [OK] rows back-filled: {cur.rowcount}")

    cur.close()
    conn.close()
    print("=== Done ===")


if __name__ == "__main__":
    run()
