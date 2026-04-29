from decimal import Decimal
from typing import Optional

from sqlalchemy.orm import Session

from models.setting import KEY_EXCHANGE_RATE, DEFAULT_EXCHANGE_RATE, Setting


class SettingRepository:
    def __init__(self, db: Session):
        self.db = db

    def get(self, key: str) -> Optional[Setting]:
        return self.db.query(Setting).filter(Setting.key == key).first()

    def get_value(self, key: str, default: str = "") -> str:
        s = self.get(key)
        return s.value if s else default

    def set(self, key: str, value: str, description: Optional[str] = None) -> Setting:
        s = self.get(key)
        if s:
            s.value = value
            if description is not None:
                s.description = description
        else:
            s = Setting(key=key, value=value, description=description)
            self.db.add(s)
        self.db.commit()
        self.db.refresh(s)
        return s

    # ---- Convenience for the exchange rate ----

    def get_exchange_rate(self) -> Decimal:
        raw = self.get_value(KEY_EXCHANGE_RATE, DEFAULT_EXCHANGE_RATE)
        try:
            return Decimal(raw)
        except Exception:
            return Decimal(DEFAULT_EXCHANGE_RATE)

    def set_exchange_rate(self, rate: Decimal) -> Setting:
        return self.set(
            KEY_EXCHANGE_RATE,
            str(rate),
            description="Number of HTG per 1 USD used when converting catalog prices at checkout",
        )
