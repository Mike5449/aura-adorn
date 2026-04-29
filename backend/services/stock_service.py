from typing import Optional

from core.exceptions import ForbiddenException, NotFoundException
from dtos.stock import StockCreate, StockUpdate
from models.stock import Stock
from repositories.stock_repository import StockRepository


class StockService:
    def __init__(self, repo: StockRepository):
        self.repo = repo

    @staticmethod
    def _is_super(user) -> bool:
        return getattr(user, "role", None) == "super_admin"

    @classmethod
    def _check_owner(cls, user, stock: Stock) -> None:
        if cls._is_super(user):
            return
        if stock.admin_user_id != getattr(user, "id", None):
            raise ForbiddenException(detail="You can only access your own stock entries")

    def list(self, current_user) -> list[Stock]:
        if self._is_super(current_user):
            return self.repo.list()
        return self.repo.list(owner_id=current_user.id)

    def get(self, stock_id: int, current_user) -> Stock:
        stock = self.repo.get_by_id(stock_id)
        if not stock:
            raise NotFoundException(detail=f"Stock {stock_id} not found")
        self._check_owner(current_user, stock)
        return stock

    def create(self, data: StockCreate, current_user) -> Stock:
        fields = data.model_dump()
        # Anchor the row to the calling user — admin creates stock for
        # themselves; super_admin also gets ownership in their own name.
        fields["admin_user_id"] = current_user.id
        return self.repo.create(fields)

    def update(self, stock_id: int, data: StockUpdate, current_user) -> Stock:
        stock = self.repo.get_by_id(stock_id)
        if not stock:
            raise NotFoundException(detail=f"Stock {stock_id} not found")
        self._check_owner(current_user, stock)
        fields = data.model_dump(exclude_unset=True)
        return self.repo.update(stock_id, fields)

    def delete(self, stock_id: int, current_user) -> None:
        stock = self.repo.get_by_id(stock_id)
        if not stock:
            raise NotFoundException(detail=f"Stock {stock_id} not found")
        self._check_owner(current_user, stock)
        self.repo.delete(stock_id)
