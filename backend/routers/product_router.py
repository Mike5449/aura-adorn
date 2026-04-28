from typing import Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from core.rbac import Permission, require_permission
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
    summary="List products (public)",
)
def list_products(
    section: Optional[str] = Query(None, description="jewelry | beauty"),
    category_id: Optional[int] = Query(None),
    status_filter: Optional[str] = Query(
        None, alias="status", description="available | coming_soon"
    ),
    active_only: bool = Query(True, description="Only return active (published) products"),
    service: ProductService = Depends(get_product_service),
):
    return service.list(
        section=section,
        category_id=category_id,
        status=status_filter,
        active_only=active_only,
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
    description="**Permission required:** `products:create`",
    responses={409: _409},
    dependencies=[Depends(require_permission(Permission.PRODUCTS_CREATE))],
)
def create_product(
    data: ProductCreate,
    service: ProductService = Depends(get_product_service),
):
    return service.create(data)


@router.patch(
    "/{product_id}",
    response_model=ProductResponse,
    summary="Update a product",
    description="**Permission required:** `products:update`",
    responses={404: _404, 409: _409},
    dependencies=[Depends(require_permission(Permission.PRODUCTS_UPDATE))],
)
def update_product(
    product_id: int,
    data: ProductUpdate,
    service: ProductService = Depends(get_product_service),
):
    return service.update(product_id, data)


@router.delete(
    "/{product_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a product",
    description="**Permission required:** `products:delete`",
    responses={404: _404},
    dependencies=[Depends(require_permission(Permission.PRODUCTS_DELETE))],
)
def delete_product(
    product_id: int,
    service: ProductService = Depends(get_product_service),
):
    service.delete(product_id)
