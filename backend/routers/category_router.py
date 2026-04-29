from typing import Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from core.rbac import Permission, require_permission
from database import get_db
from dtos.catalog import CategoryCreate, CategoryResponse, CategoryUpdate
from repositories.catalog_repository import CategoryRepository
from services.catalog_service import CategoryService

router = APIRouter(prefix="/categories", tags=["categories"])

_404 = {"description": "Category not found"}
_409 = {"description": "Slug already in use"}


def get_category_service(db: Session = Depends(get_db)) -> CategoryService:
    return CategoryService(CategoryRepository(db))


# Public endpoint — anyone can browse the storefront
@router.get(
    "/",
    response_model=list[CategoryResponse],
    summary="List categories (public)",
)
def list_categories(
    section: Optional[str] = Query(None, description="Filter by section: homme | femme"),
    service: CategoryService = Depends(get_category_service),
):
    return service.list(section=section)


@router.get(
    "/{category_id}",
    response_model=CategoryResponse,
    summary="Get a category (public)",
    responses={404: _404},
)
def get_category(category_id: int, service: CategoryService = Depends(get_category_service)):
    return service.get(category_id)


@router.post(
    "/",
    response_model=CategoryResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a category",
    description="**Permission required:** `categories:create`",
    responses={409: _409},
    dependencies=[Depends(require_permission(Permission.CATEGORIES_CREATE))],
)
def create_category(
    data: CategoryCreate,
    service: CategoryService = Depends(get_category_service),
):
    return service.create(data)


@router.patch(
    "/{category_id}",
    response_model=CategoryResponse,
    summary="Update a category",
    description="**Permission required:** `categories:update`",
    responses={404: _404, 409: _409},
    dependencies=[Depends(require_permission(Permission.CATEGORIES_UPDATE))],
)
def update_category(
    category_id: int,
    data: CategoryUpdate,
    service: CategoryService = Depends(get_category_service),
):
    return service.update(category_id, data)


@router.delete(
    "/{category_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a category",
    description="**Permission required:** `categories:delete`",
    responses={404: _404},
    dependencies=[Depends(require_permission(Permission.CATEGORIES_DELETE))],
)
def delete_category(category_id: int, service: CategoryService = Depends(get_category_service)):
    service.delete(category_id)
