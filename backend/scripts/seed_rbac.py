"""
Seed default roles and permissions into the database.

Safe to run multiple times — existing rows are skipped (idempotent).

Usage (from the backend/ directory):
    python scripts/seed_rbac.py
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import SessionLocal
from models.rbac import PermissionModel, Role, role_permissions  # noqa: F401
from core.rbac import RBAC_SEED


def seed(db) -> None:
    # 1. Ensure all permission records exist
    all_perm_tuples = {
        perm
        for role_data in RBAC_SEED.values()
        for perm in role_data["permissions"]
    }

    perm_map: dict[str, PermissionModel] = {}
    for perm_name, perm_desc in all_perm_tuples:
        existing = db.query(PermissionModel).filter_by(name=perm_name).first()
        if existing:
            perm_map[perm_name] = existing
        else:
            obj = PermissionModel(name=perm_name, description=perm_desc)
            db.add(obj)
            db.flush()  # get the id without full commit
            perm_map[perm_name] = obj
            print(f"  + permission '{perm_name}'")

    # 2. Ensure all role records exist and have correct permissions assigned
    for role_name, role_data in RBAC_SEED.items():
        role_obj = db.query(Role).filter_by(name=role_name).first()
        if not role_obj:
            role_obj = Role(name=role_name, description=role_data["description"])
            db.add(role_obj)
            db.flush()
            print(f"  + role '{role_name}'")

        # Assign permissions that are not yet linked
        existing_perm_names = {p.name for p in role_obj.permissions}
        for perm_name, _ in role_data["permissions"]:
            if perm_name not in existing_perm_names:
                role_obj.permissions.append(perm_map[perm_name])
                print(f"    -> linked '{perm_name}' to '{role_name}'")

    db.commit()
    print("RBAC seed complete.")


if __name__ == "__main__":
    db = SessionLocal()
    try:
        print("Seeding RBAC tables...")
        seed(db)
    finally:
        db.close()
