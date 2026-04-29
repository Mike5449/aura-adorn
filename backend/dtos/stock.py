from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, Field


class StockBase(BaseModel):
    reference: Optional[str] = Field(default=None, max_length=120)
    order_date: date
    arrival_date: Optional[date] = None
    total_amount: Decimal = Field(default=Decimal("0"), ge=0)
    shipping_amount: Decimal = Field(default=Decimal("0"), ge=0)
    quantity: int = Field(default=0, ge=0)
    currency: str = Field(default="HTG", max_length=8)
    notes: Optional[str] = None


class StockCreate(StockBase):
    pass


class StockUpdate(BaseModel):
    reference: Optional[str] = Field(default=None, max_length=120)
    order_date: Optional[date] = None
    arrival_date: Optional[date] = None
    total_amount: Optional[Decimal] = Field(default=None, ge=0)
    shipping_amount: Optional[Decimal] = Field(default=None, ge=0)
    quantity: Optional[int] = Field(default=None, ge=0)
    currency: Optional[str] = Field(default=None, max_length=8)
    notes: Optional[str] = None


class StockResponse(StockBase):
    id: int
    admin_user_id: int
    admin_username: Optional[str] = None  # convenient for super_admin view
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
