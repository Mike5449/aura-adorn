"""
Two changes in one shot:

1. users.commission_pct — per-admin platform commission percentage
   (super_admin gets X% of every paid order's items owned by the admin)
2. app_settings rows for delivery_fee_htg + free_delivery_threshold_htg
   so super_admin can edit them from the admin panel instead of needing
   a redeploy with a new env var

Idempotent — re-running is safe.
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

    print("=== users.commission_pct ===")
    cur.execute(
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS commission_pct NUMERIC(5,2) NOT NULL DEFAULT 0"
    )
    print("  [OK] column ready")

    print("\n=== app_settings — delivery defaults ===")
    cur.execute(
        """
        INSERT INTO app_settings (key, value, description) VALUES
          ('delivery_fee_htg', '150', 'Flat HTG fee charged when the customer ticks home delivery'),
          ('free_delivery_threshold_htg', '2500', 'Subtotal in HTG above which delivery becomes free')
        ON CONFLICT (key) DO NOTHING
        """
    )
    print(f"  [OK] rows inserted: {cur.rowcount}")

    cur.close()
    conn.close()
    print("\n=== Done ===")


if __name__ == "__main__":
    run()
