from typing import Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from core.rbac import Permission, require_permission
from core.security import get_current_active_user_optional
from database import get_db
from dtos.catalog import ProductCreate, ProductResponse, ProductUpdate
from repositories.catalog_repository import CategoryRepository, ProductRepository
from services.catalog_service import ProductService

router = APIRouter(prefix="/products", tags=["products"])

_404 = {"description": "Product not found"}
_409 = {"description": "Slug already in use"}


def get_product_service(db: Session = Depends(get_db)) -> ProductService:
    return ProductService(ProductRepository(db), CategoryRepository(db))


# ---------------------------------------------------------------------------
# Public read endpoints — used by the storefront
# ---------------------------------------------------------------------------

@router.get(
    "/",
    response_model=list[ProductResponse],
    summary="List products (public storefront + scoped admin view)",
    description=(
        "Public callers see only active products, optionally filtered by "
        "section/category. **When called with an `admin` JWT, the list is "
        "scoped to the products that admin created.** super_admin sees "
        "everything."
    ),
)
def list_products(
    section: Optional[str] = Query(None, description="homme | femme"),
    category_id: Optional[int] = Query(None),
    status_filter: Optional[str] = Query(
        None, alias="status", description="available | coming_soon"
    ),
    active_only: bool = Query(True, description="Only return active (published) products"),
    mine: bool = Query(False, description="If true and the caller is admin, scope to their products"),
    current_user=Depends(get_current_active_user_optional),
    service: ProductService = Depends(get_product_service),
):
    owner_id = None
    if current_user and current_user.role == "admin":
        # admin always sees only their own products
        owner_id = current_user.id
    elif current_user and current_user.role == "super_admin" and mine:
        owner_id = current_user.id
    return service.list(
        section=section,
        category_id=category_id,
        status=status_filter,
        active_only=active_only,
        owner_id=owner_id,
    )


@router.get(
    "/{product_id}",
    response_model=ProductResponse,
    summary="Get a product by ID (public)",
    responses={404: _404},
)
def get_product(product_id: int, service: ProductService = Depends(get_product_service)):
    return service.get(product_id)


@router.get(
    "/slug/{slug}",
    response_model=ProductResponse,
    summary="Get a product by slug (public)",
    responses={404: _404},
)
def get_product_by_slug(slug: str, service: ProductService = Depends(get_product_service)):
    return service.get_by_slug(slug)


# ---------------------------------------------------------------------------
# Admin write endpoints
# ---------------------------------------------------------------------------

@router.post(
    "/",
    response_model=ProductResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a product",
    description=(
        "**Permission required:** `products:create`. "
        "admin users can only create products in their `allowed_categories`; "
        "the new product is owned by them. super_admin is unrestricted."
    ),
    responses={409: _409},
)
def create_product(
    data: ProductCreate,
    current_user=Depends(require_permission(Permission.PRODUCTS_CREATE)),
    service: ProductService = Depends(get_product_service),
):
    return service.create(data, current_user=current_user)


@router.patch(
    "/{product_id}",
    response_model=ProductResponse,
    summary="Update a product",
    description=(
        "**Permission required:** `products:update`. "
        "admin can only update products they own."
    ),
    responses={404: _404, 409: _409},
)
def update_product(
    product_id: int,
    data: ProductUpdate,
    current_user=Depends(require_permission(Permission.PRODUCTS_UPDATE)),
    service: ProductService = Depends(get_product_service),
):
    return service.update(product_id, data, current_user=current_user)


@router.delete(
    "/{product_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a product",
    description=(
        "**Permission required:** `products:delete`. "
        "admin can only delete products they own."
    ),
    responses={404: _404},
)
def delete_product(
    product_id: int,
    current_user=Depends(require_permission(Permission.PRODUCTS_DELETE)),
    service: ProductService = Depends(get_product_service),
):
    service.delete(product_id, current_user=current_user)
