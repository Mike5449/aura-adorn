from decimal import Decimal

from pydantic import BaseModel, Field


class PublicSettings(BaseModel):
    """Public settings exposed to the storefront."""
    exchange_rate_htg_per_usd: Decimal = Field(default=Decimal("130"), gt=0)


class ExchangeRateUpdate(BaseModel):
    rate: Decimal = Field(gt=0, description="HTG per 1 USD")
