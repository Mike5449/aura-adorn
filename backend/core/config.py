from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    PROJECT_NAME: str = "Beauté & Élégance"

    # Database
    DATABASE_URL: str

    # JWT — no defaults, must be set in .env
    SECRET_KEY: str
    REFRESH_SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # CORS — comma-separated origins in .env
    CORS_ORIGINS: str = "http://localhost:3000"

    # Trusted Host header values — comma-separated. Use `*` to disable
    # the check entirely (acceptable behind a known reverse proxy on a
    # single-app box; the reverse proxy decides who reaches us).
    ALLOWED_HOSTS: str = "*"

    # Brute-force protection
    MAX_LOGIN_ATTEMPTS: int = 5
    ACCOUNT_LOCKOUT_MINUTES: int = 15

    # MonCash (Digicel mobile money) — optional; payment endpoints will fail if unset.
    MONCASH_CLIENT_ID: str = ""
    MONCASH_CLIENT_SECRET: str = ""
    MONCASH_MODE: str = "sandbox"  # "sandbox" | "production"
    MONCASH_RETURN_URL: str = "http://localhost:5173/checkout/return"

    # Delivery (livraison) — Delmas only by default
    DELIVERY_FEE_HTG: float = 150.0
    FREE_DELIVERY_THRESHOLD_HTG: float = 2500.0
    # Substring (case-insensitive) the customer's city must contain to be eligible
    DELIVERY_CITY_KEYWORD: str = "delmas"

    @property
    def cors_origins_list(self) -> List[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

    @property
    def allowed_hosts_list(self) -> List[str]:
        return [h.strip() for h in self.ALLOWED_HOSTS.split(",") if h.strip()]

    class Config:
        case_sensitive = True
        env_file = ".env"


settings = Settings()
