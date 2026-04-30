from datetime import datetime
from decimal import Decimal
from typing import List, Optional

from pydantic import BaseModel, EmailStr, Field, field_validator


VALID_ORDER_STATUSES = {"pending", "paid", "shipped", "delivered", "cancelled"}
VALID_PAYMENT_STATUSES = {"pending", "success", "failed"}


# ---------------------------------------------------------------------------
# Items the client sends when placing an order
# ---------------------------------------------------------------------------

class OrderItemCreate(BaseModel):
    product_id: int
    product_size_id: Optional[int] = None
    product_color_id: Optional[int] = None
    quantity: int = Field(ge=1)


class OrderCreate(BaseModel):
    customer_name: str = Field(min_length=1, max_length=150)
    customer_email: EmailStr
    customer_phone: str = Field(min_length=4, max_length=40)
    customer_address: str = Field(min_length=1, max_length=300)
    customer_city: str = Field(min_length=1, max_length=120)
    notes: Optional[str] = None
    delivery_requested: bool = False
    items: List[OrderItemCreate] = Field(min_length=1)


# ---------------------------------------------------------------------------
# Admin updates
# ---------------------------------------------------------------------------

class OrderStatusUpdate(BaseModel):
    status: str

    @field_validator("status")
    @classmethod
    def status_valid(cls, v: str) -> str:
        if v not in VALID_ORDER_STATUSES:
            raise ValueError(f"Status must be one of: {', '.join(sorted(VALID_ORDER_STATUSES))}")
        return v


# ---------------------------------------------------------------------------
# Responses
# ---------------------------------------------------------------------------

class OrderItemResponse(BaseModel):
    id: int
    product_id: Optional[int]
    product_size_id: Optional[int]
    product_color_id: Optional[int] = None
    product_name: str
    size_label: Optional[str]
    color_label: Optional[str] = None
    quantity: int
    unit_price: Decimal

    class Config:
        from_attributes = True


class OrderResponse(BaseModel):
    id: int
    order_number: str
    user_id: Optional[int]

    customer_name: str
    customer_email: str
    customer_phone: str
    customer_address: str
    customer_city: str
    notes: Optional[str]

    delivery_requested: bool = False
    delivery_fee: Decimal = Decimal("0")
    subtotal: Optional[Decimal] = None
    subtotal_usd: Optional[Decimal] = None
    exchange_rate_used: Optional[Decimal] = None
    total_amount: Decimal
    currency: str

    status: str
    payment_method: str
    payment_status: str
    payment_reference: Optional[str]

    items: List[OrderItemResponse]

    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
