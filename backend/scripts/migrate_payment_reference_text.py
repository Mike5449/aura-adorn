"""
Widens orders.payment_reference from VARCHAR(120) to TEXT.

MonCash CreatePayment returns a JWT as payment_token (~600-800 chars),
which we persist as payment_reference. The original VARCHAR(120) cap was
designed for short transactionIds and overflows on the JWT path.

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

    print("=== orders.payment_reference -> TEXT ===")
    # Drop the old btree index — not useful (we rarely query by reference)
    # and it would refuse very long values.
    cur.execute("DROP INDEX IF EXISTS ix_orders_payment_reference")
    print("  [OK] old index dropped (if existed)")

    cur.execute("ALTER TABLE orders ALTER COLUMN payment_reference TYPE TEXT")
    print("  [OK] column widened to TEXT")

    cur.close()
    conn.close()
    print("=== Done ===")


if __name__ == "__main__":
    run()
