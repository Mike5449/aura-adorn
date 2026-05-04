from decimal import Decimal

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from core.rbac import Permission, require_permission
from database import get_db
from dtos.setting import (
    DeliveryFeeUpdate,
    ExchangeRateUpdate,
    FreeDeliveryThresholdUpdate,
    PublicSettings,
)
from repositories.setting_repository import SettingRepository

router = APIRouter(prefix="/settings", tags=["settings"])


def get_repo(db: Session = Depends(get_db)) -> SettingRepository:
    return SettingRepository(db)


def _public_settings(repo: SettingRepository) -> PublicSettings:
    return PublicSettings(
        exchange_rate_htg_per_usd=repo.get_exchange_rate(),
        delivery_fee_htg=repo.get_delivery_fee_htg(),
        free_delivery_threshold_htg=repo.get_free_delivery_threshold_htg(),
    )


@router.get(
    "/public",
    response_model=PublicSettings,
    summary="Public settings (storefront)",
    description=(
        "Returns the configuration the storefront needs: USD→HTG exchange "
        "rate, delivery fee, free-delivery threshold."
    ),
)
def public_settings(repo: SettingRepository = Depends(get_repo)):
    return _public_settings(repo)


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
    return _public_settings(repo)


@router.patch(
    "/delivery-fee",
    response_model=PublicSettings,
    summary="Update flat delivery fee in HTG (super_admin only)",
    dependencies=[Depends(require_permission(Permission.SETTINGS_UPDATE))],
)
def update_delivery_fee(
    data: DeliveryFeeUpdate,
    repo: SettingRepository = Depends(get_repo),
):
    repo.set_delivery_fee_htg(Decimal(str(data.fee_htg)))
    return _public_settings(repo)


@router.patch(
    "/free-delivery-threshold",
    response_model=PublicSettings,
    summary="Update HTG threshold above which delivery is free (super_admin only)",
    dependencies=[Depends(require_permission(Permission.SETTINGS_UPDATE))],
)
def update_free_delivery_threshold(
    data: FreeDeliveryThresholdUpdate,
    repo: SettingRepository = Depends(get_repo),
):
    repo.set_free_delivery_threshold_htg(Decimal(str(data.threshold_htg)))
    return _public_settings(repo)
