from decimal import Decimal

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from core.rbac import Permission, require_permission
from database import get_db
from dtos.setting import ExchangeRateUpdate, PublicSettings
from repositories.setting_repository import SettingRepository

router = APIRouter(prefix="/settings", tags=["settings"])


def get_repo(db: Session = Depends(get_db)) -> SettingRepository:
    return SettingRepository(db)


@router.get(
    "/public",
    response_model=PublicSettings,
    summary="Public settings (storefront)",
    description="Returns the configuration the storefront needs (e.g. USD→HTG rate).",
)
def public_settings(repo: SettingRepository = Depends(get_repo)):
    return PublicSettings(exchange_rate_htg_per_usd=repo.get_exchange_rate())


@router.patch(
    "/exchange-rate",
    response_model=PublicSettings,
    summary="Update USD→HTG exchange rate (super_admin only)",
    dependencies=[Depends(require_permission(Permission.SETTINGS_UPDATE))],
)
def update_exchange_rate(
    data: ExchangeRateUpdate,
    repo: SettingRepository = Depends(get_repo),
):
    repo.set_exchange_rate(Decimal(str(data.rate)))
    return PublicSettings(exchange_rate_htg_per_usd=repo.get_exchange_rate())
