from decimal import Decimal

from pydantic import BaseModel, Field


class PublicSettings(BaseModel):
    """Public settings exposed to the storefront."""
    exchange_rate_htg_per_usd: Decimal = Field(default=Decimal("130"), gt=0)
    delivery_fee_htg: Decimal = Field(default=Decimal("150"), ge=0)
    free_delivery_threshold_htg: Decimal = Field(default=Decimal("2500"), ge=0)


class ExchangeRateUpdate(BaseModel):
    rate: Decimal = Field(gt=0, description="HTG per 1 USD")


class DeliveryFeeUpdate(BaseModel):
    fee_htg: Decimal = Field(ge=0, description="Flat HTG fee charged when delivery is requested")


class FreeDeliveryThresholdUpdate(BaseModel):
    threshold_htg: Decimal = Field(ge=0, description="Subtotal HTG above which delivery is free")
