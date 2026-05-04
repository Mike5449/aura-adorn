from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from database import Base


ORDER_STATUS_PENDING = "pending"
ORDER_STATUS_PAID = "paid"
ORDER_STATUS_SHIPPED = "shipped"
ORDER_STATUS_DELIVERED = "delivered"
ORDER_STATUS_CANCELLED = "cancelled"

PAYMENT_STATUS_PENDING = "pending"
PAYMENT_STATUS_SUCCESS = "success"
PAYMENT_STATUS_FAILED = "failed"

PAYMENT_METHOD_MONCASH = "moncash"


class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True)
    order_number = Column(String(40), unique=True, index=True, nullable=False)

    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)

    customer_name = Column(String(150), nullable=False)
    customer_email = Column(String(255), nullable=True)
    customer_phone = Column(String(40), nullable=False)
    customer_address = Column(String(300), nullable=False)
    customer_city = Column(String(120), nullable=False)
    notes = Column(Text, nullable=True)

    # Livraison (Delmas uniquement) — délivrable seulement si delivery_requested
    delivery_requested = Column(Boolean, default=False, nullable=False)
    delivery_fee = Column(Numeric(10, 2), default=0, nullable=False)

    subtotal = Column(Numeric(12, 2), nullable=True)  # avant livraison (HTG)
    total_amount = Column(Numeric(12, 2), nullable=False)  # HTG
    currency = Column(String(8), default="HTG", nullable=False)

    # Catalog prices are kept in USD; orders store the HTG conversion
    # using the rate active at checkout time. Keeping it on the order
    # makes historical receipts accurate even if the rate later moves.
    exchange_rate_used = Column(Numeric(10, 4), nullable=True)
    subtotal_usd = Column(Numeric(12, 2), nullable=True)

    status = Column(String(20), default=ORDER_STATUS_PENDING, nullable=False)
    payment_method = Column(String(20), default=PAYMENT_METHOD_MONCASH, nullable=False)
    payment_status = Column(String(20), default=PAYMENT_STATUS_PENDING, nullable=False)
    # MonCash returns long JWTs as payment_token; keep this unbounded.
    payment_reference = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    items = relationship(
        "OrderItem",
        back_populates="order",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    payments = relationship(
        "Payment",
        back_populates="order",
        cascade="all, delete-orphan",
        lazy="selectin",
        order_by="Payment.created_at.desc()",
    )

    @property
    def owner_user_ids(self) -> list[int]:
        """
        Distinct admin user_ids whose products are part of this order.
        In practice an order is composed of products from one admin —
        we still return a list to handle the rare cross-admin cart.
        """
        seen: set[int] = set()
        out: list[int] = []
        for item in self.items:
            product = getattr(item, "product", None)
            owner_id = getattr(product, "created_by_user_id", None) if product else None
            if owner_id and owner_id not in seen:
                seen.add(owner_id)
                out.append(owner_id)
        return out

    @property
    def platform_commission_htg(self) -> "Decimal":  # type: ignore[name-defined]
        """
        Total commission collected by the platform (super_admin) on this
        order, in HTG. Computed from each item's owning admin's current
        commission_pct. Returns 0 for unpaid orders.
        """
        from decimal import Decimal
        if self.payment_status != PAYMENT_STATUS_SUCCESS:
            return Decimal("0")
        rate = Decimal(self.exchange_rate_used) if self.exchange_rate_used else Decimal("1")
        commission_usd = Decimal("0")
        for item in self.items:
            product = getattr(item, "product", None)
            owner = getattr(product, "created_by", None) if product else None
            pct = Decimal(owner.commission_pct) if owner and owner.commission_pct else Decimal("0")
            if pct <= 0:
                continue
            line_usd = Decimal(item.unit_price) * Decimal(item.quantity)
            commission_usd += line_usd * pct / Decimal("100")
        return (commission_usd * rate).quantize(Decimal("0.01"))


class OrderItem(Base):
    __tablename__ = "order_items"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="SET NULL"), nullable=True, index=True)
    product_size_id = Column(Integer, ForeignKey("product_sizes.id", ondelete="SET NULL"), nullable=True)
    product_color_id = Column(Integer, ForeignKey("product_colors.id", ondelete="SET NULL"), nullable=True)

    product_name = Column(String(200), nullable=False)  # snapshot at time of order
    size_label = Column(String(20), nullable=True)
    color_label = Column(String(40), nullable=True)
    # Snapshot of product.image_url at time of order so the receipt /
    # admin order view stays correct even if the product is later deleted
    # or its image is changed in the catalog.
    image_url = Column(String(500), nullable=True)
    quantity = Column(Integer, nullable=False)
    unit_price = Column(Numeric(10, 2), nullable=False)

    order = relationship("Order", back_populates="items")
    # Loaded with the item so the order-detail view can compute the
    # platform commission by walking item -> product -> created_by.
    product = relationship(
        "Product",
        foreign_keys=[product_id],
        lazy="joined",
    )


class Payment(Base):
    __tablename__ = "payments"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id", ondelete="CASCADE"), nullable=False, index=True)

    method = Column(String(20), default=PAYMENT_METHOD_MONCASH, nullable=False)
    amount = Column(Numeric(12, 2), nullable=False)
    currency = Column(String(8), default="HTG", nullable=False)
    status = Column(String(20), default=PAYMENT_STATUS_PENDING, nullable=False)

    transaction_id = Column(String(120), nullable=True, index=True)
    moncash_order_id = Column(String(120), nullable=True, index=True)
    payer = Column(String(120), nullable=True)
    raw_response = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    order = relationship("Order", back_populates="payments")
