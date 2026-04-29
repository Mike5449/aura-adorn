from typing import Optional

from sqlalchemy.orm import Session

from models.stock import Stock


class StockRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_id(self, stock_id: int) -> Optional[Stock]:
        return self.db.query(Stock).filter(Stock.id == stock_id).first()

    def list(self, owner_id: Optional[int] = None) -> list[Stock]:
        q = self.db.query(Stock)
        if owner_id is not None:
            q = q.filter(Stock.admin_user_id == owner_id)
        return q.order_by(Stock.order_date.desc(), Stock.id.desc()).all()

    def create(self, fields: dict) -> Stock:
        stock = Stock(**fields)
        self.db.add(stock)
        self.db.commit()
        self.db.refresh(stock)
        return stock

    def update(self, stock_id: int, fields: dict) -> Optional[Stock]:
        stock = self.get_by_id(stock_id)
        if not stock:
            return None
        for k, v in fields.items():
            setattr(stock, k, v)
        self.db.commit()
        self.db.refresh(stock)
        return stock

    def delete(self, stock_id: int) -> bool:
        stock = self.get_by_id(stock_id)
        if not stock:
            return False
        self.db.delete(stock)
        self.db.commit()
        return True
