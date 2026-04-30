"""
Adds the color-variant feature for products (Maillot et autres).

1. products.has_colors          (boolean, default false)
2. product_colors table         (product_id, color_label, hex_code, stock, is_active)
3. order_items.product_color_id (nullable FK)
4. order_items.color_label      (nullable snapshot)

Idempotent — safe to run twice.
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

    def step(label, sql, *params):
        cur.execute(sql, params or None)
        print(f"  [OK] {label}: {cur.rowcount if cur.rowcount >= 0 else 'done'}")

    print("=== 1. products.has_colors ===")
    step(
        "ALTER products",
        "ALTER TABLE products ADD COLUMN IF NOT EXISTS has_colors BOOLEAN NOT NULL DEFAULT FALSE",
    )

    print("\n=== 2. product_colors table ===")
    step("CREATE", """
        CREATE TABLE IF NOT EXISTS product_colors (
            id SERIAL PRIMARY KEY,
            product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
            color_label VARCHAR(40) NOT NULL,
            hex_code VARCHAR(9),
            stock INTEGER NOT NULL DEFAULT 0,
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """)
    step(
        "INDEX product_id",
        "CREATE INDEX IF NOT EXISTS ix_product_colors_product_id ON product_colors(product_id)",
    )

    print("\n=== 3. order_items.product_color_id + color_label ===")
    step(
        "ALTER order_items.product_color_id",
        "ALTER TABLE order_items ADD COLUMN IF NOT EXISTS product_color_id INTEGER "
        "REFERENCES product_colors(id) ON DELETE SET NULL",
    )
    step(
        "ALTER order_items.color_label",
        "ALTER TABLE order_items ADD COLUMN IF NOT EXISTS color_label VARCHAR(40)",
    )

    print("\n=== Done ===")
    cur.close()
    conn.close()


if __name__ == "__main__":
    run()
