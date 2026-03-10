"""
Role-Based Access Control (RBAC)

Permissions are stored in the database (tables: roles, permissions, role_permissions).
On first request the permission map is loaded into an in-memory cache so every
subsequent check is O(1) without a DB round-trip.

If the DB tables have not been seeded yet the module falls back transparently to
the built-in ROLE_PERMISSIONS dict so the API keeps working.

Call `invalidate_permissions_cache()` after changing DB permissions to force a
reload on the next request.
"""
from enum import Enum
from typing import Dict, Set

from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session

from core.security import get_current_active_user
from database import get_db


# ---------------------------------------------------------------------------
# Permission enum — single source of truth for permission names in code
# ---------------------------------------------------------------------------
class Permission(str, Enum):
    # User resource
    USERS_CREATE      = "users:create"       # Create a new user account
    USERS_READ        = "users:read"          # Read any user profile
    USERS_READ_SELF   = "users:read_self"     # Read own profile (all roles)
    USERS_LIST        = "users:list"          # List all users
    USERS_UPDATE      = "users:update"        # Update a user's email / details
    USERS_UPDATE_SELF = "users:update_self"   # Update own email / password
    USERS_DELETE      = "users:delete"        # Hard-delete a user
    USERS_CHANGE_ROLE = "users:change_role"   # Assign a role to a user
    USERS_DEACTIVATE  = "users:deactivate"    # Enable / disable a user account


# ---------------------------------------------------------------------------
# Built-in fallback — used when the DB tables are empty or unreachable
# ---------------------------------------------------------------------------
_BUILTIN_ROLE_PERMISSIONS: Dict[str, Set[str]] = {
    "admin": {p.value for p in Permission},  # admin gets everything
    "manager": {
        Permission.USERS_READ.value,
        Permission.USERS_READ_SELF.value,
        Permission.USERS_LIST.value,
        Permission.USERS_UPDATE_SELF.value,
    },
    "staff": {
        Permission.USERS_READ_SELF.value,
        Permission.USERS_UPDATE_SELF.value,
    },
}

# Seed data for populating the DB (role name → description + permission list)
RBAC_SEED: Dict[str, dict] = {
    "admin": {
        "description": "Full access to all resources",
        "permissions": [
            ("users:create",      "Create a new user account"),
            ("users:read",        "Read any user profile"),
            ("users:read_self",   "Read own profile"),
            ("users:list",        "List all users"),
            ("users:update",      "Update any user's details"),
            ("users:update_self", "Update own email / password"),
            ("users:delete",      "Permanently delete a user"),
            ("users:change_role", "Assign a role to a user"),
            ("users:deactivate",  "Enable or disable a user account"),
        ],
    },
    "manager": {
        "description": "Read and list users, update own profile",
        "permissions": [
            ("users:read",        "Read any user profile"),
            ("users:read_self",   "Read own profile"),
            ("users:list",        "List all users"),
            ("users:update_self", "Update own email / password"),
        ],
    },
    "staff": {
        "description": "Read and update own profile only",
        "permissions": [
            ("users:read_self",   "Read own profile"),
            ("users:update_self", "Update own email / password"),
        ],
    },
}


# ---------------------------------------------------------------------------
# In-memory permissions cache  { role_name -> set of permission name strings }
# ---------------------------------------------------------------------------
_permissions_cache: Dict[str, Set[str]] = {}


def invalidate_permissions_cache() -> None:
    """Clear the cache so the next request reloads from the DB."""
    _permissions_cache.clear()


def _build_cache_from_db(db: Session) -> bool:
    """
    Populate _permissions_cache from the database.
    Returns True if at least one role was found, False if the tables are empty.
    """
    try:
        from models.rbac import Role as RoleModel

        roles = db.query(RoleModel).all()
        if not roles:
            return False

        cache: Dict[str, Set[str]] = {}
        for role in roles:
            cache[role.name] = {p.name for p in role.permissions}
        _permissions_cache.update(cache)
        return True
    except Exception:
        # Table may not exist yet (before migration runs)
        return False


def get_role_permissions(role: str, db: Session | None = None) -> Set[str]:
    """
    Return the set of permission names for *role*.
    Loads from DB on first call; falls back to built-in dict if DB is empty.
    """
    if not _permissions_cache and db is not None:
        _build_cache_from_db(db)
    if _permissions_cache:
        return _permissions_cache.get(role, set())
    # Fallback
    return _BUILTIN_ROLE_PERMISSIONS.get(role, set())


# ---------------------------------------------------------------------------
# FastAPI dependency factory
# ---------------------------------------------------------------------------
def require_permission(permission: Permission):
    """
    Usage:
        @router.get("/", dependencies=[Depends(require_permission(Permission.USERS_LIST))])

    Also works as a regular dependency when you need the current user object:
        current_user = Depends(require_permission(Permission.USERS_DELETE))
    """

    async def _checker(
        current_user=Depends(get_current_active_user),
        db: Session = Depends(get_db),
    ):
        role_perms = get_role_permissions(current_user.role, db)
        if permission.value not in role_perms:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission denied: '{permission.value}' required",
            )
        return current_user

    # Unique name so FastAPI treats each permission as a separate dependency
    _checker.__name__ = f"require_{permission.value.replace(':', '_')}"
    return _checker
