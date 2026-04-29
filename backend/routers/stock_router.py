from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from core.rbac import Permission, require_permission
from database import get_db
from dtos.stock import StockCreate, StockResponse, StockUpdate
from repositories.stock_repository import StockRepository
from services.stock_service import StockService

router = APIRouter(prefix="/stocks", tags=["stocks"])

_404 = {"description": "Stock not found"}


def get_stock_service(db: Session = Depends(get_db)) -> StockService:
    return StockService(StockRepository(db))


def _to_response(stock) -> dict:
    """Embed the admin's username for the super_admin view."""
    return {
        "id": stock.id,
        "admin_user_id": stock.admin_user_id,
        "admin_username": stock.admin.username if stock.admin else None,
        "reference": stock.reference,
        "order_date": stock.order_date,
        "arrival_date": stock.arrival_date,
        "total_amount": stock.total_amount,
        "shipping_amount": stock.shipping_amount,
        "quantity": stock.quantity,
        "currency": stock.currency,
        "notes": stock.notes,
        "created_at": stock.created_at,
        "updated_at": stock.updated_at,
    }


@router.get(
    "/",
    response_model=list[StockResponse],
    summary="List stock receipts",
    description=(
        "**Permission required:** `stocks:list`. "
        "admin sees only their own; super_admin sees all (with `admin_username`)."
    ),
)
def list_stocks(
    current_user=Depends(require_permission(Permission.STOCKS_LIST)),
    service: StockService = Depends(get_stock_service),
):
    return [_to_response(s) for s in service.list(current_user)]


@router.get(
    "/{stock_id}",
    response_model=StockResponse,
    summary="Get a stock receipt",
    responses={404: _404},
)
def get_stock(
    stock_id: int,
    current_user=Depends(require_permission(Permission.STOCKS_READ)),
    service: StockService = Depends(get_stock_service),
):
    return _to_response(service.get(stock_id, current_user))


@router.post(
    "/",
    response_model=StockResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Record a new stock receipt",
    description="**Permission required:** `stocks:create`",
)
def create_stock(
    data: StockCreate,
    current_user=Depends(require_permission(Permission.STOCKS_CREATE)),
    service: StockService = Depends(get_stock_service),
):
    return _to_response(service.create(data, current_user))


@router.patch(
    "/{stock_id}",
    response_model=StockResponse,
    summary="Update a stock receipt",
    responses={404: _404},
)
def update_stock(
    stock_id: int,
    data: StockUpdate,
    current_user=Depends(require_permission(Permission.STOCKS_UPDATE)),
    service: StockService = Depends(get_stock_service),
):
    return _to_response(service.update(stock_id, data, current_user))


@router.delete(
    "/{stock_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a stock receipt",
    responses={404: _404},
)
def delete_stock(
    stock_id: int,
    current_user=Depends(require_permission(Permission.STOCKS_DELETE)),
    service: StockService = Depends(get_stock_service),
):
    service.delete(stock_id, current_user)
