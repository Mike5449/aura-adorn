from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Table,
    Text,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from database import Base


PRODUCT_STATUS_AVAILABLE = "available"
PRODUCT_STATUS_COMING_SOON = "coming_soon"


# Many-to-many: which leaf categories an admin user is allowed to add
# products to. super_admin ignores this; their access is unrestricted.
user_allowed_categories = Table(
    "user_allowed_categories",
    Base.metadata,
    Column("user_id", Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
    Column("category_id", Integer, ForeignKey("categories.id", ondelete="CASCADE"), primary_key=True),
)


class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, index=True)
    slug = Column(String(80), unique=True, index=True, nullable=False)
    name = Column(String(120), nullable=False)
    section = Column(String(40), nullable=False)  # homme | femme
    display_order = Column(Integer, default=0, nullable=False)

    # Self-referential hierarchy. parent_id NULL means a top-level "group"
    # (Bijoux, Parfums, Maillots, Beauté). Categories with a parent are
    # leaf categories (Bagues, Visage, Yeux, …) where products attach.
    parent_id = Column(
        Integer,
        ForeignKey("categories.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    parent = relationship(
        "Category",
        remote_side="Category.id",
        backref="children",
        lazy="joined",
    )
    products = relationship("Product", back_populates="category", lazy="selectin")


class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    slug = Column(String(120), unique=True, index=True, nullable=False)
    name = Column(String(200), nullable=False)
    description = Column(Text, nullable=False)
    price = Column(Numeric(10, 2), nullable=False)
    # Prix d'achat (cost). Used for margin tracking — not exposed on the
    # storefront. Optional, defaults to 0 if unknown.
    purchase_price = Column(Numeric(10, 2), nullable=False, default=0, server_default="0")
    image_url = Column(String(500), nullable=False)

    category_id = Column(Integer, ForeignKey("categories.id", ondelete="RESTRICT"), nullable=False, index=True)
    section = Column(String(40), nullable=False)  # cached from category for fast filtering

    status = Column(String(20), default=PRODUCT_STATUS_AVAILABLE, nullable=False)  # available | coming_soon
    is_bestseller = Column(Boolean, default=False, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    has_sizes = Column(Boolean, default=False, nullable=False)
    stock = Column(Integer, default=0, nullable=False)  # ignored if has_sizes=True

    # Owner — the admin who created the product. Used to scope listing
    # ("each admin sees only their own products"). super_admin sees all.
    created_by_user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    category = relationship("Category", back_populates="products", lazy="joined")
    sizes = relationship(
        "ProductSize",
        back_populates="product",
        cascade="all, delete-orphan",
        lazy="selectin",
        order_by="ProductSize.size_label",
    )
    created_by = relationship("User", lazy="joined", foreign_keys=[created_by_user_id])


class ProductSize(Base):
    __tablename__ = "product_sizes"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True)
    size_label = Column(String(20), nullable=False)  # e.g. "52", "54" for rings
    stock = Column(Integer, default=0, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    product = relationship("Product", back_populates="sizes")
