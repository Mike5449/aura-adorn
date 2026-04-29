from typing import Optional

from sqlalchemy.orm import Session

from models.catalog import Category, Product, ProductSize


class CategoryRepository:
    def __init__(self, db: Session):
        self.db = db

    # ---------------- Reads ----------------

    def get_by_id(self, category_id: int) -> Optional[Category]:
        return self.db.query(Category).filter(Category.id == category_id).first()

    def get_by_slug(self, slug: str) -> Optional[Category]:
        return self.db.query(Category).filter(Category.slug == slug).first()

    def list_all(self, section: Optional[str] = None) -> list[Category]:
        q = self.db.query(Category)
        if section:
            q = q.filter(Category.section == section)
        return q.order_by(Category.section, Category.display_order, Category.name).all()

    # ---------------- Writes ----------------

    def create(self, fields: dict) -> Category:
        cat = Category(**fields)
        self.db.add(cat)
        self.db.commit()
        self.db.refresh(cat)
        return cat

    def update(self, category_id: int, fields: dict) -> Optional[Category]:
        cat = self.get_by_id(category_id)
        if not cat:
            return None
        for k, v in fields.items():
            setattr(cat, k, v)
        self.db.commit()
        self.db.refresh(cat)
        return cat

    def delete(self, category_id: int) -> bool:
        cat = self.get_by_id(category_id)
        if not cat:
            return False
        self.db.delete(cat)
        self.db.commit()
        return True


class ProductRepository:
    def __init__(self, db: Session):
        self.db = db

    # ---------------- Reads ----------------

    def get_by_id(self, product_id: int) -> Optional[Product]:
        return self.db.query(Product).filter(Product.id == product_id).first()

    def get_by_slug(self, slug: str) -> Optional[Product]:
        return self.db.query(Product).filter(Product.slug == slug).first()

    def list_all(
        self,
        section: Optional[str] = None,
        category_id: Optional[int] = None,
        status: Optional[str] = None,
        active_only: bool = False,
        owner_id: Optional[int] = None,
    ) -> list[Product]:
        q = self.db.query(Product)
        if active_only:
            q = q.filter(Product.is_active.is_(True))
        if section:
            q = q.filter(Product.section == section)
        if category_id is not None:
            q = q.filter(Product.category_id == category_id)
        if status:
            q = q.filter(Product.status == status)
        if owner_id is not None:
            q = q.filter(Product.created_by_user_id == owner_id)
        return q.order_by(Product.created_at.desc()).all()

    # ---------------- Writes ----------------

    def create(self, fields: dict) -> Product:
        product = Product(**fields)
        self.db.add(product)
        self.db.commit()
        self.db.refresh(product)
        return product

    def update(self, product_id: int, fields: dict) -> Optional[Product]:
        product = self.get_by_id(product_id)
        if not product:
            return None
        for k, v in fields.items():
            setattr(product, k, v)
        self.db.commit()
        self.db.refresh(product)
        return product

    def delete(self, product_id: int) -> bool:
        product = self.get_by_id(product_id)
        if not product:
            return False
        self.db.delete(product)
        self.db.commit()
        return True

    # ---------------- Sizes ----------------

    def replace_sizes(self, product_id: int, sizes: list[dict]) -> None:
        """Drop existing sizes and replace with the supplied list."""
        self.db.query(ProductSize).filter(ProductSize.product_id == product_id).delete()
        for s in sizes:
            self.db.add(ProductSize(product_id=product_id, **s))
        self.db.commit()

    def get_size(self, size_id: int) -> Optional[ProductSize]:
        return self.db.query(ProductSize).filter(ProductSize.id == size_id).first()

    def decrement_size_stock(self, size_id: int, qty: int) -> None:
        size = self.get_size(size_id)
        if size:
            size.stock = max(0, size.stock - qty)
            self.db.commit()

    def decrement_product_stock(self, product_id: int, qty: int) -> None:
        product = self.get_by_id(product_id)
        if product:
            product.stock = max(0, product.stock - qty)
            self.db.commit()
