import re
from decimal import Decimal
from typing import List, Optional

from pydantic import BaseModel, Field, field_validator


VALID_SECTIONS = {"jewelry", "beauty"}
VALID_PRODUCT_STATUSES = {"available", "coming_soon"}
_SLUG_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")


def _slug_validator(v: str) -> str:
    v = v.strip().lower()
    if not _SLUG_RE.match(v):
        raise ValueError(
            "Slug must be lowercase letters/digits separated by single hyphens"
        )
    return v


# ---------------------------------------------------------------------------
# Category
# ---------------------------------------------------------------------------

class CategoryBase(BaseModel):
    slug: str
    name: str = Field(min_length=1, max_length=120)
    section: str
    display_order: int = 0

    @field_validator("slug")
    @classmethod
    def slug_valid(cls, v: str) -> str:
        return _slug_validator(v)

    @field_validator("section")
    @classmethod
    def section_valid(cls, v: str) -> str:
        if v not in VALID_SECTIONS:
            raise ValueError(f"Section must be one of: {', '.join(sorted(VALID_SECTIONS))}")
        return v


class CategoryCreate(CategoryBase):
    pass


class CategoryUpdate(BaseModel):
    slug: Optional[str] = None
    name: Optional[str] = Field(default=None, min_length=1, max_length=120)
    section: Optional[str] = None
    display_order: Optional[int] = None

    @field_validator("slug")
    @classmethod
    def slug_valid(cls, v: Optional[str]) -> Optional[str]:
        return _slug_validator(v) if v is not None else v

    @field_validator("section")
    @classmethod
    def section_valid(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in VALID_SECTIONS:
            raise ValueError(f"Section must be one of: {', '.join(sorted(VALID_SECTIONS))}")
        return v


class CategoryResponse(CategoryBase):
    id: int

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# Product Size
# ---------------------------------------------------------------------------

class ProductSizeBase(BaseModel):
    size_label: str = Field(min_length=1, max_length=20)
    stock: int = Field(ge=0, default=0)
    is_active: bool = True


class ProductSizeCreate(ProductSizeBase):
    pass


class ProductSizeResponse(ProductSizeBase):
    id: int

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# Product
# ---------------------------------------------------------------------------

class ProductBase(BaseModel):
    slug: str
    name: str = Field(min_length=1, max_length=200)
    description: str = Field(min_length=1)
    price: Decimal = Field(ge=0)
    image_url: str = Field(min_length=1, max_length=500)
    category_id: int
    status: str = "available"
    is_bestseller: bool = False
    is_active: bool = True
    has_sizes: bool = False
    stock: int = Field(ge=0, default=0)

    @field_validator("slug")
    @classmethod
    def slug_valid(cls, v: str) -> str:
        return _slug_validator(v)

    @field_validator("status")
    @classmethod
    def status_valid(cls, v: str) -> str:
        if v not in VALID_PRODUCT_STATUSES:
            raise ValueError(
                f"Status must be one of: {', '.join(sorted(VALID_PRODUCT_STATUSES))}"
            )
        return v


class ProductCreate(ProductBase):
    sizes: List[ProductSizeCreate] = []


class ProductUpdate(BaseModel):
    slug: Optional[str] = None
    name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    description: Optional[str] = Field(default=None, min_length=1)
    price: Optional[Decimal] = Field(default=None, ge=0)
    image_url: Optional[str] = Field(default=None, min_length=1, max_length=500)
    category_id: Optional[int] = None
    status: Optional[str] = None
    is_bestseller: Optional[bool] = None
    is_active: Optional[bool] = None
    has_sizes: Optional[bool] = None
    stock: Optional[int] = Field(default=None, ge=0)
    sizes: Optional[List[ProductSizeCreate]] = None

    @field_validator("slug")
    @classmethod
    def slug_valid(cls, v: Optional[str]) -> Optional[str]:
        return _slug_validator(v) if v is not None else v

    @field_validator("status")
    @classmethod
    def status_valid(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in VALID_PRODUCT_STATUSES:
            raise ValueError(
                f"Status must be one of: {', '.join(sorted(VALID_PRODUCT_STATUSES))}"
            )
        return v


class ProductResponse(BaseModel):
    id: int
    slug: str
    name: str
    description: str
    price: Decimal
    image_url: str
    category_id: int
    section: str
    status: str
    is_bestseller: bool
    is_active: bool
    has_sizes: bool
    stock: int
    sizes: List[ProductSizeResponse] = []

    class Config:
        from_attributes = True
