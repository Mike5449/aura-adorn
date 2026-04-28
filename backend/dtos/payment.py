from datetime import datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel


class PaymentInitiateResponse(BaseModel):
    """Returned to the frontend after creating a MonCash payment session."""
    order_id: int
    order_number: str
    amount: Decimal
    currency: str
    payment_token: str
    redirect_url: str  # the URL the customer is redirected to in order to pay


class PaymentVerifyRequest(BaseModel):
    """Customer-supplied transaction id after returning from MonCash."""
    transaction_id: str


class PaymentResponse(BaseModel):
    id: int
    order_id: int
    method: str
    amount: Decimal
    currency: str
    status: str
    transaction_id: Optional[str]
    moncash_order_id: Optional[str]
    payer: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True
