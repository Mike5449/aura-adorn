from typing import Optional

from sqlalchemy.orm import Session

from models.order import Order, OrderItem, Payment


class OrderRepository:
    def __init__(self, db: Session):
        self.db = db

    # ---------------- Reads ----------------

    def get_by_id(self, order_id: int) -> Optional[Order]:
        return self.db.query(Order).filter(Order.id == order_id).first()

    def get_by_order_number(self, order_number: str) -> Optional[Order]:
        return self.db.query(Order).filter(Order.order_number == order_number).first()

    def list_all(
        self,
        status: Optional[str] = None,
        user_id: Optional[int] = None,
        owner_id: Optional[int] = None,
    ) -> list[Order]:
        """
        owner_id, when set, scopes to orders that contain at least one
        order_item whose product was created by that user. Used to give
        admins a view of "their" orders.
        """
        q = self.db.query(Order)
        if status:
            q = q.filter(Order.status == status)
        if user_id is not None:
            q = q.filter(Order.user_id == user_id)
        if owner_id is not None:
            from models.catalog import Product
            q = (
                q.join(OrderItem, OrderItem.order_id == Order.id)
                 .join(Product, Product.id == OrderItem.product_id)
                 .filter(Product.created_by_user_id == owner_id)
                 .distinct()
            )
        return q.order_by(Order.created_at.desc()).all()

    # ---------------- Writes ----------------

    def create(self, order: Order, items: list[OrderItem]) -> Order:
        self.db.add(order)
        self.db.flush()  # populate order.id
        for item in items:
            item.order_id = order.id
            self.db.add(item)
        self.db.commit()
        self.db.refresh(order)
        return order

    def update_fields(self, order_id: int, fields: dict) -> Optional[Order]:
        order = self.get_by_id(order_id)
        if not order:
            return None
        for k, v in fields.items():
            setattr(order, k, v)
        self.db.commit()
        self.db.refresh(order)
        return order

    def delete(self, order_id: int) -> bool:
        order = self.get_by_id(order_id)
        if not order:
            return False
        self.db.delete(order)
        self.db.commit()
        return True


class PaymentRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_id(self, payment_id: int) -> Optional[Payment]:
        return self.db.query(Payment).filter(Payment.id == payment_id).first()

    def get_by_transaction_id(self, transaction_id: str) -> Optional[Payment]:
        return self.db.query(Payment).filter(Payment.transaction_id == transaction_id).first()

    def latest_for_order(self, order_id: int) -> Optional[Payment]:
        return (
            self.db.query(Payment)
            .filter(Payment.order_id == order_id)
            .order_by(Payment.created_at.desc())
            .first()
        )

    def create(self, payment: Payment) -> Payment:
        self.db.add(payment)
        self.db.commit()
        self.db.refresh(payment)
        return payment

    def update_fields(self, payment_id: int, fields: dict) -> Optional[Payment]:
        payment = self.get_by_id(payment_id)
        if not payment:
            return None
        for k, v in fields.items():
            setattr(payment, k, v)
        self.db.commit()
        self.db.refresh(payment)
        return payment
