import logging
from typing import Optional

from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

from core.rbac import Permission, require_permission
from core.security import get_current_active_user_optional
from database import get_db
from dtos.order import OrderCreate, OrderResponse, OrderStatusUpdate
from dtos.payment import PaymentInitiateResponse, PaymentVerifyRequest
from repositories.catalog_repository import ProductRepository
from repositories.order_repository import OrderRepository, PaymentRepository
from services.order_service import OrderService

router = APIRouter(prefix="/orders", tags=["orders"])

_404 = {"description": "Order not found"}


def get_order_service(db: Session = Depends(get_db)) -> OrderService:
    return OrderService(
        order_repo=OrderRepository(db),
        product_repo=ProductRepository(db),
        payment_repo=PaymentRepository(db),
    )


# ---------------------------------------------------------------------------
# Public checkout — guests allowed (user_id captured if authenticated)
# ---------------------------------------------------------------------------

@router.post(
    "/",
    response_model=OrderResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Place an order (public)",
    description=(
        "Guests can place an order without authentication. "
        "If the request is authenticated the order is linked to the current user."
    ),
)
def create_order(
    data: OrderCreate,
    current_user=Depends(get_current_active_user_optional),
    service: OrderService = Depends(get_order_service),
):
    user_id = current_user.id if current_user else None
    return service.create(data, user_id=user_id)


@router.post(
    "/{order_id}/pay/moncash",
    response_model=PaymentInitiateResponse,
    summary="Initiate a MonCash payment for an order (public)",
)
def initiate_moncash(
    order_id: int,
    service: OrderService = Depends(get_order_service),
):
    return service.initiate_moncash_payment(order_id)


@router.post(
    "/{order_id}/pay/moncash/verify",
    response_model=OrderResponse,
    summary="Verify a MonCash payment when the order id is already known (admin / retry)",
)
def verify_moncash(
    order_id: int,
    data: PaymentVerifyRequest,
    service: OrderService = Depends(get_order_service),
):
    return service.verify_moncash_payment(order_id, data.transaction_id)


@router.post(
    "/pay/moncash/resolve",
    response_model=OrderResponse,
    summary="Resolve a MonCash payment from its transactionId only (public)",
    description=(
        "Used by the customer return URL configured in the MonCash merchant portal. "
        "The endpoint asks MonCash for the transaction details, identifies the "
        "matching order via the `orderId` MonCash echoes back, finalises the "
        "payment and returns the order. **No order id required in the URL.**"
    ),
)
def resolve_moncash(
    data: PaymentVerifyRequest,
    service: OrderService = Depends(get_order_service),
):
    return service.resolve_moncash_payment(data.transaction_id)


@router.post(
    "/moncash/webhook",
    summary="MonCash IPN / webhook (public)",
    description=(
        "Server-to-server notification endpoint for MonCash. Configure this URL "
        "in the merchant portal as the **Notification URL** (IPN).\n\n"
        "We treat the payload as untrusted — we extract any `transactionId` "
        "field we can find and re-fetch the transaction from MonCash to confirm "
        "the order before marking it paid. This prevents spoofed webhooks from "
        "altering order state."
    ),
)
async def moncash_webhook(
    request: Request,
    service: OrderService = Depends(get_order_service),
):
    try:
        payload = await request.json()
    except Exception:
        payload = {}

    txn = (
        payload.get("transactionId")
        or payload.get("transaction_id")
        or (payload.get("payment") or {}).get("transaction_id")
        or (payload.get("data") or {}).get("transactionId")
    )
    if not txn:
        return {"received": True, "status": "ignored", "reason": "no transactionId"}

    try:
        service.resolve_moncash_payment(str(txn))
    except Exception as exc:  # log but do not 500 — MonCash will retry
        logger.warning("MonCash webhook processing failed: %s", exc)
        return {"received": True, "status": "deferred"}
    return {"received": True, "status": "processed"}


@router.get(
    "/by-number/{order_number}",
    response_model=OrderResponse,
    summary="Look up an order by its order number (public)",
    responses={404: _404},
)
def get_by_number(
    order_number: str,
    service: OrderService = Depends(get_order_service),
):
    return service.get_by_number(order_number)


# ---------------------------------------------------------------------------
# Admin
# ---------------------------------------------------------------------------

@router.get(
    "/",
    response_model=list[OrderResponse],
    summary="List orders",
    description="**Permission required:** `orders:list`",
    dependencies=[Depends(require_permission(Permission.ORDERS_LIST))],
)
def list_orders(
    status_filter: Optional[str] = Query(None, alias="status"),
    service: OrderService = Depends(get_order_service),
):
    return service.list(status=status_filter)


@router.get(
    "/{order_id}",
    response_model=OrderResponse,
    summary="Get an order",
    description="**Permission required:** `orders:read`",
    responses={404: _404},
    dependencies=[Depends(require_permission(Permission.ORDERS_READ))],
)
def get_order(order_id: int, service: OrderService = Depends(get_order_service)):
    return service.get(order_id)


@router.patch(
    "/{order_id}/status",
    response_model=OrderResponse,
    summary="Update an order's fulfilment status",
    description="**Permission required:** `orders:update`",
    responses={404: _404},
    dependencies=[Depends(require_permission(Permission.ORDERS_UPDATE))],
)
def update_order_status(
    order_id: int,
    data: OrderStatusUpdate,
    service: OrderService = Depends(get_order_service),
):
    return service.update_status(order_id, data.status)


@router.delete(
    "/{order_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete an order",
    description="**Permission required:** `orders:delete`",
    responses={404: _404},
    dependencies=[Depends(require_permission(Permission.ORDERS_DELETE))],
)
def delete_order(
    order_id: int,
    service: OrderService = Depends(get_order_service),
):
    service.repo.delete(order_id)
