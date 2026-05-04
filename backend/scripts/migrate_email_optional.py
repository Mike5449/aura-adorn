"""
Make orders.customer_email optional.

Customers can now place an order without an email; the field is only used
to send the confirmation receipt when provided.

Idempotent — re-running the ALTER on an already-nullable column is a no-op
in PostgreSQL.
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
    cur.execute("ALTER TABLE orders ALTER COLUMN customer_email DROP NOT NULL")
    print("[OK] orders.customer_email is now nullable")
    cur.close()
    conn.close()


if __name__ == "__main__":
    run()
