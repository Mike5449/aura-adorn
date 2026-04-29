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

    # Categories
    CATEGORIES_CREATE = "categories:create"
    CATEGORIES_READ   = "categories:read"
    CATEGORIES_LIST   = "categories:list"
    CATEGORIES_UPDATE = "categories:update"
    CATEGORIES_DELETE = "categories:delete"

    # Products
    PRODUCTS_CREATE = "products:create"
    PRODUCTS_READ   = "products:read"
    PRODUCTS_LIST   = "products:list"
    PRODUCTS_UPDATE = "products:update"
    PRODUCTS_DELETE = "products:delete"

    # Orders
    ORDERS_CREATE = "orders:create"
    ORDERS_READ   = "orders:read"
    ORDERS_LIST   = "orders:list"
    ORDERS_UPDATE = "orders:update"
    ORDERS_DELETE = "orders:delete"

    # Payments
    PAYMENTS_READ = "payments:read"
    PAYMENTS_LIST = "payments:list"

    # Stocks (admin supplier orders)
    STOCKS_CREATE = "stocks:create"
    STOCKS_READ   = "stocks:read"
    STOCKS_LIST   = "stocks:list"
    STOCKS_UPDATE = "stocks:update"
    STOCKS_DELETE = "stocks:delete"

    # System settings (e.g. USD↔HTG exchange rate)
    SETTINGS_UPDATE = "settings:update"


# ---------------------------------------------------------------------------
# Built-in fallback — used when the DB tables are empty or unreachable
# ---------------------------------------------------------------------------
_BUILTIN_ROLE_PERMISSIONS: Dict[str, Set[str]] = {
    # super_admin can do absolutely everything (including managing users
    # and categories). Only role with full power.
    "super_admin": {p.value for p in Permission},

    # admin is now scoped: can curate THEIR OWN products inside their
    # allowed categories, see their related orders, manage their own
    # stock receipts, but cannot manage users or categories.
    "admin": {
        Permission.USERS_READ_SELF.value,
        Permission.USERS_UPDATE_SELF.value,
        # Read access on the catalog so the product form can list categories
        Permission.CATEGORIES_LIST.value,
        Permission.CATEGORIES_READ.value,
        # Products — full CRUD but service-layer scopes to created_by
        Permission.PRODUCTS_CREATE.value,
        Permission.PRODUCTS_READ.value,
        Permission.PRODUCTS_LIST.value,
        Permission.PRODUCTS_UPDATE.value,
        Permission.PRODUCTS_DELETE.value,
        # Orders — read-only, scoped at service-level to admin's products
        Permission.ORDERS_READ.value,
        Permission.ORDERS_LIST.value,
        Permission.ORDERS_UPDATE.value,
        Permission.PAYMENTS_READ.value,
        Permission.PAYMENTS_LIST.value,
        # Stocks — full CRUD on the admin's own stock receipts
        Permission.STOCKS_CREATE.value,
        Permission.STOCKS_READ.value,
        Permission.STOCKS_LIST.value,
        Permission.STOCKS_UPDATE.value,
        Permission.STOCKS_DELETE.value,
    },

    # manager (legacy): trimmed catalog editor + user reader
    "manager": {
        Permission.USERS_READ.value,
        Permission.USERS_READ_SELF.value,
        Permission.USERS_LIST.value,
        Permission.USERS_UPDATE_SELF.value,
        Permission.CATEGORIES_READ.value,
        Permission.CATEGORIES_LIST.value,
        Permission.CATEGORIES_UPDATE.value,
        Permission.PRODUCTS_READ.value,
        Permission.PRODUCTS_LIST.value,
        Permission.PRODUCTS_CREATE.value,
        Permission.PRODUCTS_UPDATE.value,
        Permission.ORDERS_READ.value,
        Permission.ORDERS_LIST.value,
        Permission.ORDERS_UPDATE.value,
        Permission.PAYMENTS_READ.value,
        Permission.PAYMENTS_LIST.value,
    },

    # staff: read-only catalog + own profile
    "staff": {
        Permission.USERS_READ_SELF.value,
        Permission.USERS_UPDATE_SELF.value,
        Permission.CATEGORIES_LIST.value,
        Permission.CATEGORIES_READ.value,
        Permission.PRODUCTS_LIST.value,
        Permission.PRODUCTS_READ.value,
    },
}

# Seed data for populating the DB (role name → description + permission list)
_USER_PERMS_DESC = {
    "users:create":      "Create a new user account",
    "users:read":        "Read any user profile",
    "users:read_self":   "Read own profile",
    "users:list":        "List all users",
    "users:update":      "Update any user's details",
    "users:update_self": "Update own email / password",
    "users:delete":      "Permanently delete a user",
    "users:change_role": "Assign a role to a user",
    "users:deactivate":  "Enable or disable a user account",
}
_CATALOG_PERMS_DESC = {
    "categories:create": "Create a new category",
    "categories:read":   "Read a category",
    "categories:list":   "List categories",
    "categories:update": "Update a category",
    "categories:delete": "Delete a category",
    "products:create":   "Create a new product",
    "products:read":     "Read a product",
    "products:list":     "List products",
    "products:update":   "Update a product",
    "products:delete":   "Delete a product",
}
_COMMERCE_PERMS_DESC = {
    "orders:create": "Create an order (checkout)",
    "orders:read":   "Read any order",
    "orders:list":   "List orders",
    "orders:update": "Update order status / fulfilment",
    "orders:delete": "Delete an order",
    "payments:read": "Read a payment record",
    "payments:list": "List payments",
    "stocks:create": "Record a new stock receipt",
    "stocks:read":   "Read a stock receipt",
    "stocks:list":   "List stock receipts",
    "stocks:update": "Update a stock receipt",
    "stocks:delete": "Delete a stock receipt",
    "settings:update": "Update system settings (e.g. exchange rate)",
}

_ALL_PERMS_DESC = {**_USER_PERMS_DESC, **_CATALOG_PERMS_DESC, **_COMMERCE_PERMS_DESC}


def _perms_for_role(role: str) -> list[tuple[str, str]]:
    return [(name, _ALL_PERMS_DESC[name]) for name in sorted(_BUILTIN_ROLE_PERMISSIONS[role])]


RBAC_SEED: Dict[str, dict] = {
    "super_admin": {
        "description": "Owner of the platform — manages users, categories, and the entire catalog",
        "permissions": _perms_for_role("super_admin"),
    },
    "admin": {
        "description": "Curates their own products in assigned categories; sees related orders only",
        "permissions": _perms_for_role("admin"),
    },
    "manager": {
        "description": "Read and list users, curate catalog, manage orders, update own profile",
        "permissions": _perms_for_role("manager"),
    },
    "staff": {
        "description": "Read catalog, read and update own profile",
        "permissions": _perms_for_role("staff"),
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
