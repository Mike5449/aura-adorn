from sqlalchemy import Column, DateTime, Integer, String
from sqlalchemy.sql import func

from database import Base


class Setting(Base):
    """
    Generic key/value store for global app settings.
    Key example: 'exchange_rate_htg_per_usd' → '130'
    """
    __tablename__ = "app_settings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    key = Column(String(80), unique=True, nullable=False, index=True)
    value = Column(String(255), nullable=False)
    description = Column(String(255), nullable=True)

    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


# Well-known keys
KEY_EXCHANGE_RATE = "exchange_rate_htg_per_usd"
DEFAULT_EXCHANGE_RATE = "130"  # 1 USD ≈ 130 HTG (override via /admin/settings)

KEY_DELIVERY_FEE_HTG = "delivery_fee_htg"
DEFAULT_DELIVERY_FEE_HTG = "150"  # flat HTG fee when delivery is requested

KEY_FREE_DELIVERY_THRESHOLD_HTG = "free_delivery_threshold_htg"
DEFAULT_FREE_DELIVERY_THRESHOLD_HTG = "2500"  # delivery becomes free above this subtotal
