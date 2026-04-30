import re
from typing import List, Optional

from pydantic import BaseModel, EmailStr, field_validator

VALID_ROLES = {"super_admin", "admin", "manager", "staff"}

_USERNAME_RE = re.compile(r"^[a-zA-Z0-9_]{3,50}$")
_HAS_UPPER   = re.compile(r"[A-Z]")
_HAS_LOWER   = re.compile(r"[a-z]")
_HAS_DIGIT   = re.compile(r"\d")
_HAS_SPECIAL = re.compile(r'[!@#$%^&*()\-_=+\[\]{};:\'",.<>?/\|`~]')


def _validate_password(v: str) -> str:
    errors = []
    if len(v) < 8:
        errors.append("at least 8 characters")
    if not _HAS_UPPER.search(v):
        errors.append("one uppercase letter")
    if not _HAS_LOWER.search(v):
        errors.append("one lowercase letter")
    if not _HAS_DIGIT.search(v):
        errors.append("one digit")
    if not _HAS_SPECIAL.search(v):
        errors.append("one special character")
    if errors:
        raise ValueError("Password must contain " + ", ".join(errors))
    return v


# ---------------------------------------------------------------------------
# Base / Create
# ---------------------------------------------------------------------------

class UserBase(BaseModel):
    username: str
    email: EmailStr

    @field_validator("username")
    @classmethod
    def username_valid(cls, v: str) -> str:
        if not _USERNAME_RE.match(v):
            raise ValueError(
                "Username must be 3–50 characters and contain only letters, digits, or underscores"
            )
        return v.lower()


class UserCreate(UserBase):
    password: str

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        return _validate_password(v)


# ---------------------------------------------------------------------------
# Self-update (any authenticated user — own profile only)
# Fields that users are allowed to change on themselves.
# ---------------------------------------------------------------------------

class UserSelfUpdate(BaseModel):
    email: Optional[EmailStr] = None
    password: Optional[str] = None
    # Required when `password` is set: the user must re-authenticate by
    # echoing back their current password. Prevents a stolen session
    # cookie from being upgraded into a permanent password swap.
    current_password: Optional[str] = None

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        return _validate_password(v)


# ---------------------------------------------------------------------------
# Admin update (admin only — can change any field on any user)
# ---------------------------------------------------------------------------

class UserAdminUpdate(BaseModel):
    email: Optional[EmailStr] = None
    password: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        return _validate_password(v)

    @field_validator("role")
    @classmethod
    def role_valid(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in VALID_ROLES:
            raise ValueError(f"Role must be one of: {', '.join(sorted(VALID_ROLES))}")
        return v


# ---------------------------------------------------------------------------
# Dedicated single-field update DTOs (used by admin endpoints)
# ---------------------------------------------------------------------------

class UserRoleUpdate(BaseModel):
    role: str

    @field_validator("role")
    @classmethod
    def role_valid(cls, v: str) -> str:
        if v not in VALID_ROLES:
            raise ValueError(f"Role must be one of: {', '.join(sorted(VALID_ROLES))}")
        return v


class UserStatusUpdate(BaseModel):
    is_active: bool


# ---------------------------------------------------------------------------
# Response
# ---------------------------------------------------------------------------

class AdminCreate(UserBase):
    """
    Used by super_admin to create another privileged user.

    `role` may be:
      - "admin"        — scoped admin, restricted to `allowed_category_ids`
      - "super_admin"  — full access (no scope; allowed_category_ids ignored)

    Defaults to "admin" so the existing flow keeps working unchanged.
    """
    password: str
    role: str = "admin"
    allowed_category_ids: List[int] = []
    is_active: bool = True

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        return _validate_password(v)

    @field_validator("role")
    @classmethod
    def role_valid(cls, v: str) -> str:
        if v not in ("admin", "super_admin"):
            raise ValueError("Role must be 'admin' or 'super_admin'")
        return v


class AdminAllowedCategoriesUpdate(BaseModel):
    """Replace the set of categories an admin can post products to."""
    allowed_category_ids: List[int]


class CategoryRef(BaseModel):
    """Minimal category info embedded in user responses."""
    id: int
    slug: str
    name: str

    class Config:
        from_attributes = True


class UserResponse(UserBase):
    id: int
    is_active: bool
    role: str
    allowed_categories: List[CategoryRef] = []

    class Config:
        from_attributes = True
