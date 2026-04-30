from __future__ import annotations

from typing import Optional

from core.exceptions import (
    BaseAPIException,
    ForbiddenException,
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
        if data.parent_id is not None:
            parent = self.repo.get_by_id(data.parent_id)
            if not parent:
                raise NotFoundException(detail=f"Parent category {data.parent_id} not found")
            if parent.section != data.section:
                raise BaseAPIException(
                    detail="Parent category must be in the same section"
                )
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
        # Validate parent if changed
        if "parent_id" in fields and fields["parent_id"] is not None:
            if fields["parent_id"] == category_id:
                raise BaseAPIException(detail="A category cannot be its own parent")
            new_parent = self.repo.get_by_id(fields["parent_id"])
            if not new_parent:
                raise NotFoundException(detail=f"Parent category {fields['parent_id']} not found")
            target_section = fields.get("section", existing.section)
            if new_parent.section != target_section:
                raise BaseAPIException(detail="Parent category must be in the same section")
            # Prevent cycles: new_parent must not descend from existing
            ancestor = new_parent.parent
            while ancestor is not None:
                if ancestor.id == category_id:
                    raise BaseAPIException(detail="Circular parent relationship is not allowed")
                ancestor = ancestor.parent

        updated = self.repo.update(category_id, fields)
        # If section changed, propagate to all child products AND child categories
        if updated and "section" in fields:
            for p in updated.products:
                p.section = updated.section
            for child in updated.children:
                child.section = updated.section
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
        owner_id: Optional[int] = None,
    ) -> list[Product]:
        return self.repo.list_all(
            section=section,
            category_id=category_id,
            status=status,
            active_only=active_only,
            owner_id=owner_id,
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

    # ---------------- Authorization helpers ----------------

    @staticmethod
    def _is_super(user) -> bool:
        return getattr(user, "role", None) == "super_admin"

    @classmethod
    def _check_can_edit(cls, user, product: Product) -> None:
        """admin can only edit/delete their own products."""
        if cls._is_super(user):
            return
        if product.created_by_user_id == getattr(user, "id", None):
            return
        raise ForbiddenException(detail="You can only modify products you created")

    @classmethod
    def _check_category_allowed(cls, user, category) -> None:
        """admin can only post to categories they have been granted."""
        if cls._is_super(user):
            return
        allowed_ids = {c.id for c in (getattr(user, "allowed_categories", None) or [])}
        if category.id not in allowed_ids:
            raise ForbiddenException(
                detail=f"Category '{category.name}' is not in your allowed categories"
            )

    # ---------------- Write ----------------

    def create(self, data: ProductCreate, current_user=None) -> Product:
        if self.repo.get_by_slug(data.slug):
            raise UserAlreadyExistsException(detail="Slug already in use")
        category = self.category_repo.get_by_id(data.category_id)
        if not category:
            raise NotFoundException(detail=f"Category {data.category_id} not found")

        if current_user is not None:
            self._check_category_allowed(current_user, category)

        fields = data.model_dump(exclude={"sizes", "colors"})
        fields["section"] = category.section
        if current_user is not None:
            fields["created_by_user_id"] = getattr(current_user, "id", None)
        product = self.repo.create(fields)

        if data.sizes:
            self.repo.replace_sizes(
                product.id,
                [s.model_dump() for s in data.sizes],
            )
            self.repo.db.refresh(product)
        if data.colors:
            self.repo.replace_colors(
                product.id,
                [c.model_dump() for c in data.colors],
            )
            self.repo.db.refresh(product)
        return product

    def update(self, product_id: int, data: ProductUpdate, current_user=None) -> Product:
        product = self.repo.get_by_id(product_id)
        if not product:
            raise NotFoundException(detail=f"Product {product_id} not found")

        if current_user is not None:
            self._check_can_edit(current_user, product)

        fields = data.model_dump(exclude_unset=True, exclude={"sizes", "colors"})

        if "slug" in fields:
            other = self.repo.get_by_slug(fields["slug"])
            if other and other.id != product_id:
                raise UserAlreadyExistsException(detail="Slug already in use")

        if "category_id" in fields:
            category = self.category_repo.get_by_id(fields["category_id"])
            if not category:
                raise NotFoundException(detail=f"Category {fields['category_id']} not found")
            if current_user is not None:
                self._check_category_allowed(current_user, category)
            fields["section"] = category.section

        updated = self.repo.update(product_id, fields)

        if data.sizes is not None:
            self.repo.replace_sizes(
                product_id,
                [s.model_dump() for s in data.sizes],
            )
            self.repo.db.refresh(updated)
        if data.colors is not None:
            self.repo.replace_colors(
                product_id,
                [c.model_dump() for c in data.colors],
            )
            self.repo.db.refresh(updated)
        return updated

    def delete(self, product_id: int, current_user=None) -> None:
        product = self.repo.get_by_id(product_id)
        if not product:
            raise NotFoundException(detail=f"Product {product_id} not found")
        if current_user is not None:
            self._check_can_edit(current_user, product)
        self.repo.delete(product_id)
