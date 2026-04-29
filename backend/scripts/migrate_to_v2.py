"""
One-shot migration applying ALL the schema changes since v1:

1. categories.parent_id (hierarchy)
2. Rename sections jewelry→homme, beauty→femme
3. Create top-level groups (Bijoux Homme, Parfums, Maillot, Bijoux Femme, Beauté)
4. Set parent_id on existing leaves to point to those groups
5. products.created_by_user_id
6. user_allowed_categories table (for scoped admins)
7. Promote existing admin → super_admin (if any)
8. Set ownership of all existing products to that super_admin
9. products.purchase_price
10. stocks table
11. app_settings table + seed exchange_rate_htg_per_usd=130
12. orders.exchange_rate_used + orders.subtotal_usd
13. Convert all product prices from HTG to USD (divide by 130)

Idempotent — safe to run twice (each step uses IF NOT EXISTS / ON CONFLICT
or checks current state before touching data).

Usage from inside the backend container (or local backend dir):
    python scripts/migrate_to_v2.py
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

    print("=== 1. categories.parent_id ===")
    step("ALTER categories",
         "ALTER TABLE categories ADD COLUMN IF NOT EXISTS parent_id INTEGER REFERENCES categories(id) ON DELETE SET NULL")
    step("INDEX",
         "CREATE INDEX IF NOT EXISTS ix_categories_parent_id ON categories(parent_id)")

    print("\n=== 2. Rename sections jewelry/beauty → homme/femme ===")
    step("categories.section jewelry→homme",
         "UPDATE categories SET section='homme' WHERE section='jewelry'")
    step("categories.section beauty→femme",
         "UPDATE categories SET section='femme' WHERE section='beauty'")
    step("products.section jewelry→homme",
         "UPDATE products SET section='homme' WHERE section='jewelry'")
    step("products.section beauty→femme",
         "UPDATE products SET section='femme' WHERE section='beauty'")

    print("\n=== 3. Top-level groups ===")
    GROUPS = [
        ("bijoux-homme",   "Bijoux",  "homme", 10),
        ("parfums-homme",  "Parfums", "homme", 20),
        ("maillots-homme", "Maillot", "homme", 30),
        ("bijoux-femme",   "Bijoux",  "femme", 10),
        ("beaute-femme",   "Beauté",  "femme", 20),
    ]
    for slug, name, section, order in GROUPS:
        cur.execute(
            "INSERT INTO categories (slug, name, section, display_order, parent_id) "
            "VALUES (%s, %s, %s, %s, NULL) ON CONFLICT (slug) DO NOTHING",
            (slug, name, section, order),
        )
    print(f"  [OK] groups upserted: {len(GROUPS)}")

    print("\n=== 4. Link existing leaves to their group ===")
    LEAVES = {
        "bijoux-homme": [("rings", 10), ("bracelets", 20), ("chains", 30), ("watches", 40), ("earrings", 50)],
        "beaute-femme": [("face", 10), ("eyes", 20), ("lips", 30), ("tools", 40), ("kits", 50)],
    }
    for parent_slug, leaves in LEAVES.items():
        for leaf_slug, order in leaves:
            cur.execute(
                "UPDATE categories SET parent_id=(SELECT id FROM categories WHERE slug=%s), display_order=%s "
                "WHERE slug=%s AND parent_id IS NULL",
                (parent_slug, order, leaf_slug),
            )
    print("  [OK] leaves linked")

    print("\n=== 5. products.created_by_user_id ===")
    step("ALTER products",
         "ALTER TABLE products ADD COLUMN IF NOT EXISTS created_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL")
    step("INDEX",
         "CREATE INDEX IF NOT EXISTS ix_products_created_by_user_id ON products(created_by_user_id)")

    print("\n=== 6. user_allowed_categories table ===")
    step("CREATE", """
        CREATE TABLE IF NOT EXISTS user_allowed_categories (
            user_id     INTEGER NOT NULL REFERENCES users(id)      ON DELETE CASCADE,
            category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
            PRIMARY KEY (user_id, category_id)
        )
    """)

    print("\n=== 7. Promote existing admin → super_admin ===")
    cur.execute("UPDATE users SET role='super_admin' WHERE role='admin'")
    print(f"  [OK] users promoted to super_admin: {cur.rowcount}")

    print("\n=== 8. Assign existing products to the (now-super_admin) owner ===")
    cur.execute("SELECT id FROM users WHERE role='super_admin' ORDER BY id LIMIT 1")
    row = cur.fetchone()
    if row:
        super_id = row[0]
        cur.execute(
            "UPDATE products SET created_by_user_id=%s WHERE created_by_user_id IS NULL",
            (super_id,),
        )
        print(f"  [OK] {cur.rowcount} products assigned to super_admin id={super_id}")
    else:
        print("  [WARN] no super_admin user found — products stay unowned")

    print("\n=== 9. products.purchase_price ===")
    step("ALTER products",
         "ALTER TABLE products ADD COLUMN IF NOT EXISTS purchase_price NUMERIC(10,2) NOT NULL DEFAULT 0")

    print("\n=== 10. stocks table ===")
    step("CREATE", """
        CREATE TABLE IF NOT EXISTS stocks (
            id SERIAL PRIMARY KEY,
            admin_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            reference VARCHAR(120),
            order_date DATE NOT NULL,
            arrival_date DATE,
            total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
            shipping_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
            quantity INTEGER NOT NULL DEFAULT 0,
            currency VARCHAR(8) NOT NULL DEFAULT 'HTG',
            notes TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """)
    step("INDEX",
         "CREATE INDEX IF NOT EXISTS ix_stocks_admin_user_id ON stocks(admin_user_id)")

    print("\n=== 11. app_settings table + seed exchange rate ===")
    step("CREATE", """
        CREATE TABLE IF NOT EXISTS app_settings (
            id SERIAL PRIMARY KEY,
            key VARCHAR(80) UNIQUE NOT NULL,
            value VARCHAR(255) NOT NULL,
            description VARCHAR(255),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """)
    step("INDEX",
         "CREATE INDEX IF NOT EXISTS ix_app_settings_key ON app_settings(key)")
    step("seed exchange rate", """
        INSERT INTO app_settings (key, value, description)
        VALUES ('exchange_rate_htg_per_usd', '130', 'HTG per 1 USD at checkout')
        ON CONFLICT (key) DO NOTHING
    """)

    print("\n=== 12. orders.exchange_rate_used + subtotal_usd ===")
    step("ALTER orders.exchange_rate_used",
         "ALTER TABLE orders ADD COLUMN IF NOT EXISTS exchange_rate_used NUMERIC(10,4)")
    step("ALTER orders.subtotal_usd",
         "ALTER TABLE orders ADD COLUMN IF NOT EXISTS subtotal_usd NUMERIC(12,2)")

    print("\n=== 13. Convert product prices HTG → USD (divide by 130) ===")
    # Only convert if not already done — heuristic: if max(price) > 1000 it
    # is probably still in HTG. (USD prices for jewelry rarely exceed 1000.)
    cur.execute("SELECT MAX(price) FROM products")
    max_price = cur.rowcount and cur.fetchone()[0]
    if max_price is not None and float(max_price) > 1000:
        cur.execute("UPDATE products SET price = ROUND(price / 130, 2)")
        print(f"  [OK] {cur.rowcount} prices divided by 130")
        cur.execute("UPDATE products SET purchase_price = ROUND(purchase_price / 130, 2) WHERE purchase_price > 0")
        print(f"  [OK] {cur.rowcount} purchase_prices divided by 130")
    else:
        print(f"  [SKIP] max price = {max_price} → looks already in USD, conversion skipped")

    print("\n=== Done ===")

    cur.close()
    conn.close()


if __name__ == "__main__":
    run()
