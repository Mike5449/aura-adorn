"""
Bootstrap script — creates the first admin user if one does not exist yet.

Usage (run from the backend/ directory):
    python scripts/seed_admin.py

Environment variables:
    ADMIN_USERNAME  (default: admin)
    ADMIN_EMAIL     (default: admin@boteakelegans.com)
    ADMIN_PASSWORD  (required — no default)
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.security import get_password_hash
from database import SessionLocal
from models.user import User

ADMIN_USERNAME = os.getenv("ADMIN_USERNAME", "admin")
ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "admin@boteakelegans.com")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "")

if not ADMIN_PASSWORD:
    print("ERROR: Set ADMIN_PASSWORD before running this script.")
    print("  Windows: set ADMIN_PASSWORD=MyStr0ng!Pass && python scripts/seed_admin.py")
    sys.exit(1)

db = SessionLocal()
try:
    if db.query(User).filter(User.username == ADMIN_USERNAME).first():
        print(f"Admin '{ADMIN_USERNAME}' already exists — skipping.")
    else:
        db.add(
            User(
                username=ADMIN_USERNAME,
                email=ADMIN_EMAIL,
                hashed_password=get_password_hash(ADMIN_PASSWORD),
                role="admin",
                is_active=True,
                is_superuser=True,
            )
        )
        db.commit()
        print(f"Admin '{ADMIN_USERNAME}' created successfully.")
finally:
    db.close()
