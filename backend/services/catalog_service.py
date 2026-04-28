from __future__ import annotations

from typing import Optional

from core.exceptions import (
    BaseAPIException,
    NotFoundException,
    UserAlreadyExistsException,
)
from dtos.catalog import (
    CategoryCreate,
    CategoryUpdate,
    ProductCreate,
    ProductUpdate,
)
from models.catalog import Category, Product
from repositories.catalog_repository import CategoryRepository, ProductRepository


class CategoryService:
    def __init__(self, repo: CategoryRepository):
        self.repo = repo

    def list(self, section: Optional[str] = None) -> list[Category]:
        return self.repo.list_all(section=section)

    def get(self, category_id: int) -> Category:
        cat = self.repo.get_by_id(category_id)
        if not cat:
            raise NotFoundException(detail=f"Category {category_id} not found")
        return cat

    def create(self, data: CategoryCreate) -> Category:
        if self.repo.get_by_slug(data.slug):
            raise UserAlreadyExistsException(detail="Slug already in use")
        return self.repo.create(data.model_dump())

    def update(self, category_id: int, data: CategoryUpdate) -> Category:
        existing = self.repo.get_by_id(category_id)
        if not existing:
            raise NotFoundException(detail=f"Category {category_id} not found")
        fields = data.model_dump(exclude_unset=True)
        if "slug" in fields:
            other = self.repo.get_by_slug(fields["slug"])
            if other and other.id != category_id:
                raise UserAlreadyExistsException(detail="Slug already in use")
        updated = self.repo.update(category_id, fields)
        # If section changed, propagate to all child products
        if updated and "section" in fields:
            for p in updated.products:
                p.section = updated.section
            self.repo.db.commit()
        return updated

    def delete(self, category_id: int) -> None:
        existing = self.repo.get_by_id(category_id)
        if not existing:
            raise NotFoundException(detail=f"Category {category_id} not found")
        if existing.products:
            raise BaseAPIException(detail="Cannot delete a category that still has products")
        self.repo.delete(category_id)


class ProductService:
    def __init__(
        self,
        product_repo: ProductRepository,
        category_repo: CategoryRepository,
    ):
        self.repo = product_repo
        self.category_repo = category_repo

    # ---------------- Read ----------------

    def list(
        self,
        section: Optional[str] = None,
        category_id: Optional[int] = None,
        status: Optional[str] = None,
        active_only: bool = False,
    ) -> list[Product]:
        return self.repo.list_all(
            section=section,
            category_id=category_id,
            status=status,
            active_only=active_only,
        )

    def get(self, product_id: int) -> Product:
        product = self.repo.get_by_id(product_id)
        if not product:
            raise NotFoundException(detail=f"Product {product_id} not found")
        return product

    def get_by_slug(self, slug: str) -> Product:
        product = self.repo.get_by_slug(slug)
        if not product:
            raise NotFoundException(detail=f"Product '{slug}' not found")
        return product

    # ---------------- Write ----------------

    def create(self, data: ProductCreate) -> Product:
        if self.repo.get_by_slug(data.slug):
            raise UserAlreadyExistsException(detail="Slug already in use")
        category = self.category_repo.get_by_id(data.category_id)
        if not category:
            raise NotFoundException(detail=f"Category {data.category_id} not found")

        fields = data.model_dump(exclude={"sizes"})
        fields["section"] = category.section
        product = self.repo.create(fields)

        if data.sizes:
            self.repo.replace_sizes(
                product.id,
                [s.model_dump() for s in data.sizes],
            )
            self.repo.db.refresh(product)
        return product

    def update(self, product_id: int, data: ProductUpdate) -> Product:
        product = self.repo.get_by_id(product_id)
        if not product:
            raise NotFoundException(detail=f"Product {product_id} not found")

        fields = data.model_dump(exclude_unset=True, exclude={"sizes"})

        if "slug" in fields:
            other = self.repo.get_by_slug(fields["slug"])
            if other and other.id != product_id:
                raise UserAlreadyExistsException(detail="Slug already in use")

        if "category_id" in fields:
            category = self.category_repo.get_by_id(fields["category_id"])
            if not category:
                raise NotFoundException(detail=f"Category {fields['category_id']} not found")
            fields["section"] = category.section

        updated = self.repo.update(product_id, fields)

        if data.sizes is not None:
            self.repo.replace_sizes(
                product_id,
                [s.model_dump() for s in data.sizes],
            )
            self.repo.db.refresh(updated)
        return updated

    def delete(self, product_id: int) -> None:
        if not self.repo.get_by_id(product_id):
            raise NotFoundException(detail=f"Product {product_id} not found")
        self.repo.delete(product_id)
