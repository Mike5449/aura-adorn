from __future__ import annotations

import json
import secrets
import string
from decimal import Decimal
from typing import Optional

from core.config import settings
from core.exceptions import BaseAPIException, ForbiddenException, NotFoundException
from dtos.order import OrderCreate, OrderItemCreate
from models.order import (
    ORDER_STATUS_CANCELLED,
    ORDER_STATUS_PAID,
    ORDER_STATUS_PENDING,
    PAYMENT_METHOD_MONCASH,
    PAYMENT_STATUS_FAILED,
    PAYMENT_STATUS_PENDING,
    PAYMENT_STATUS_SUCCESS,
    Order,
    OrderItem,
    Payment,
)
from repositories.catalog_repository import ProductRepository
from repositories.order_repository import OrderRepository, PaymentRepository
from repositories.setting_repository import SettingRepository
from services.moncash_client import MonCashClient, MonCashError


class OutOfStockException(BaseAPIException):
    status_code = 409
    detail = "Product is out of stock"


class UnavailableProductException(BaseAPIException):
    status_code = 409
    detail = "Product is not yet available for purchase"


class DeliveryUnavailableException(BaseAPIException):
    status_code = 422
    detail = "Delivery only available in Delmas"


def _is_delivery_eligible_city(city: str) -> bool:
    keyword = (settings.DELIVERY_CITY_KEYWORD or "").strip().lower()
    return bool(keyword) and keyword in (city or "").strip().lower()


def _compute_delivery_fee(subtotal: Decimal) -> Decimal:
    threshold = Decimal(str(settings.FREE_DELIVERY_THRESHOLD_HTG))
    if subtotal >= threshold:
        return Decimal("0")
    return Decimal(str(settings.DELIVERY_FEE_HTG))


def _generate_order_number() -> str:
    alphabet = string.ascii_uppercase + string.digits
    return "ORD-" + "".join(secrets.choice(alphabet) for _ in range(10))


class OrderService:
    def __init__(
        self,
        order_repo: OrderRepository,
        product_repo: ProductRepository,
        payment_repo: PaymentRepository,
        moncash: Optional[MonCashClient] = None,
    ):
        self.repo = order_repo
        self.product_repo = product_repo
        self.payment_repo = payment_repo
        self.moncash = moncash or MonCashClient()

    # ------------------------------------------------------------------
    # Read
    # ------------------------------------------------------------------

    def list(
        self,
        status: Optional[str] = None,
        user_id: Optional[int] = None,
        owner_id: Optional[int] = None,
    ) -> list[Order]:
        return self.repo.list_all(status=status, user_id=user_id, owner_id=owner_id)

    def get(self, order_id: int) -> Order:
        order = self.repo.get_by_id(order_id)
        if not order:
            raise NotFoundException(detail=f"Order {order_id} not found")
        return order

    def get_by_number(self, order_number: str) -> Order:
        order = self.repo.get_by_order_number(order_number)
        if not order:
            raise NotFoundException(detail=f"Order '{order_number}' not found")
        return order

    def get_for_user(self, order_id: int, user_id: Optional[int]) -> Order:
        """Return the order only if it belongs to user_id (or is a guest order)."""
        order = self.get(order_id)
        if user_id is not None and order.user_id is not None and order.user_id != user_id:
            raise ForbiddenException(detail="You cannot access this order")
        return order

    # ------------------------------------------------------------------
    # Create
    # ------------------------------------------------------------------

    def create(self, data: OrderCreate, user_id: Optional[int] = None) -> Order:
        # Catalog prices live in USD. We compute the items + subtotal in USD,
        # then convert to HTG using the active exchange rate. Delivery fee
        # and the free-delivery threshold remain in HTG (local).
        items, subtotal_usd = self._build_items_and_total(data.items)

        rate = SettingRepository(self.repo.db).get_exchange_rate()
        subtotal_htg = (subtotal_usd * rate).quantize(Decimal("0.01"))

        delivery_fee = Decimal("0")
        if data.delivery_requested:
            if not _is_delivery_eligible_city(data.customer_city):
                raise DeliveryUnavailableException(
                    detail=(
                        "La livraison est disponible uniquement à "
                        f"{settings.DELIVERY_CITY_KEYWORD.capitalize()}."
                    )
                )
            delivery_fee = _compute_delivery_fee(subtotal_htg)

        total_htg = subtotal_htg + delivery_fee

        order = Order(
            order_number=_generate_order_number(),
            user_id=user_id,
            customer_name=data.customer_name,
            customer_email=data.customer_email,
            customer_phone=data.customer_phone,
            customer_address=data.customer_address,
            customer_city=data.customer_city,
            notes=data.notes,
            delivery_requested=data.delivery_requested,
            delivery_fee=delivery_fee,
            subtotal=subtotal_htg,
            subtotal_usd=subtotal_usd,
            exchange_rate_used=rate,
            total_amount=total_htg,
            currency="HTG",
            status=ORDER_STATUS_PENDING,
            payment_method=PAYMENT_METHOD_MONCASH,
            payment_status=PAYMENT_STATUS_PENDING,
        )
        return self.repo.create(order, items)

    def _build_items_and_total(
        self, items_in: list[OrderItemCreate]
    ) -> tuple[list[OrderItem], Decimal]:
        total = Decimal("0")
        items: list[OrderItem] = []
        for it in items_in:
            product = self.product_repo.get_by_id(it.product_id)
            if not product or not product.is_active:
                raise NotFoundException(detail=f"Product {it.product_id} not found")
            if product.status != "available":
                raise UnavailableProductException(
                    detail=f"'{product.name}' is not yet available"
                )

            size_label = None
            if product.has_sizes:
                if it.product_size_id is None:
                    raise BaseAPIException(
                        detail=f"A size is required for '{product.name}'"
                    )
                size = self.product_repo.get_size(it.product_size_id)
                if not size or size.product_id != product.id or not size.is_active:
                    raise NotFoundException(detail="Size not found for this product")
                if size.stock < it.quantity:
                    raise OutOfStockException(
                        detail=f"Only {size.stock} unit(s) available for size {size.size_label}"
                    )
                size_label = size.size_label
            else:
                if product.stock < it.quantity:
                    raise OutOfStockException(
                        detail=f"Only {product.stock} unit(s) of '{product.name}' available"
                    )

            unit_price = Decimal(product.price)
            total += unit_price * it.quantity

            items.append(
                OrderItem(
                    product_id=product.id,
                    product_size_id=it.product_size_id,
                    product_name=product.name,
                    size_label=size_label,
                    quantity=it.quantity,
                    unit_price=unit_price,
                )
            )
        return items, total

    # ------------------------------------------------------------------
    # Admin status
    # ------------------------------------------------------------------

    def update_status(self, order_id: int, status: str) -> Order:
        order = self.get(order_id)
        return self.repo.update_fields(order_id, {"status": status})

    def cancel(self, order_id: int) -> Order:
        return self.update_status(order_id, ORDER_STATUS_CANCELLED)

    # ------------------------------------------------------------------
    # Payment — MonCash
    # ------------------------------------------------------------------

    def initiate_moncash_payment(self, order_id: int) -> dict:
        order = self.get(order_id)
        if order.status != ORDER_STATUS_PENDING:
            raise BaseAPIException(detail="Order is not pending payment")

        try:
            result = self.moncash.create_payment(
                order_id=order.order_number,
                amount=float(order.total_amount),
            )
        except MonCashError as exc:
            raise BaseAPIException(detail=str(exc))

        payment = Payment(
            order_id=order.id,
            method=PAYMENT_METHOD_MONCASH,
            amount=order.total_amount,
            currency=order.currency,
            status=PAYMENT_STATUS_PENDING,
            moncash_order_id=order.order_number,
            raw_response=json.dumps(result["raw"])[:4000],
        )
        self.payment_repo.create(payment)

        self.repo.update_fields(
            order.id,
            {"payment_reference": result["payment_token"]},
        )

        return {
            "order_id": order.id,
            "order_number": order.order_number,
            "amount": order.total_amount,
            "currency": order.currency,
            "payment_token": result["payment_token"],
            "redirect_url": result["redirect_url"],
        }

    def resolve_moncash_payment(self, transaction_id: str) -> Order:
        """
        Verify a MonCash payment using ONLY the transactionId returned by
        the gateway. MonCash echoes back our `orderId` (= our order_number)
        in `RetrieveTransactionPayment`, so we don't need to track it in
        the customer's browser. This is the path used by /checkout/return.
        """
        if not transaction_id:
            raise BaseAPIException(detail="Missing transactionId")

        try:
            data = self.moncash.retrieve_transaction(transaction_id)
        except MonCashError as exc:
            raise BaseAPIException(detail=str(exc))

        payment_obj = data.get("payment", data) or {}
        # The `reference` field in MonCash's RetrieveTransactionPayment
        # response carries back the orderId we passed to CreatePayment —
        # i.e. our order_number. Some integrations also place it under
        # `order_id` so we tolerate both.
        order_number = (
            payment_obj.get("reference")
            or payment_obj.get("order_id")
            or payment_obj.get("orderId")
        )
        if not order_number:
            raise NotFoundException(detail="Order reference missing in MonCash response")

        order = self.repo.get_by_order_number(str(order_number))
        if not order:
            raise NotFoundException(detail=f"Order '{order_number}' not found")

        return self._apply_verification(order, transaction_id, data)

    def verify_moncash_payment(self, order_id: int, transaction_id: str) -> Order:
        """
        Same as `resolve_moncash_payment` but constrained to a known
        order_id — kept for callers that already know the local order id
        (e.g. an admin tool re-running verification).
        """
        order = self.get(order_id)
        try:
            data = self.moncash.retrieve_transaction(transaction_id)
        except MonCashError as exc:
            raise BaseAPIException(detail=str(exc))
        return self._apply_verification(order, transaction_id, data)

    def _apply_verification(
        self,
        order: Order,
        transaction_id: str,
        data: dict,
    ) -> Order:
        payment_obj = data.get("payment", data) or {}
        # MonCash only returns a populated `payment` object with a transaction_id
        # for successful, fully-paid transactions. We additionally cross-check
        # the cost against the order total to defend against tampering.
        paid_cost = float(payment_obj.get("cost") or 0)
        success = bool(
            payment_obj.get("transaction_id")
            and paid_cost + 0.01 >= float(order.total_amount)
        )

        latest_payment = self.payment_repo.latest_for_order(order.id)
        new_status = PAYMENT_STATUS_SUCCESS if success else PAYMENT_STATUS_FAILED

        if latest_payment:
            self.payment_repo.update_fields(
                latest_payment.id,
                {
                    "status": new_status,
                    "transaction_id": transaction_id,
                    "payer": payment_obj.get("payer"),
                    "raw_response": json.dumps(data)[:4000],
                },
            )

        if success:
            # decrement stock
            for item in order.items:
                if item.product_size_id is not None:
                    self.product_repo.decrement_size_stock(item.product_size_id, item.quantity)
                elif item.product_id is not None:
                    self.product_repo.decrement_product_stock(item.product_id, item.quantity)

            return self.repo.update_fields(
                order.id,
                {
                    "status": ORDER_STATUS_PAID,
                    "payment_status": PAYMENT_STATUS_SUCCESS,
                    "payment_reference": transaction_id,
                },
            )
        else:
            return self.repo.update_fields(
                order.id,
                {"payment_status": PAYMENT_STATUS_FAILED},
            )
