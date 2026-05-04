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
from services.email_service import send_email
from services.moncash_client import MonCashClient, MonCashError


def _abs_image_url(raw: Optional[str]) -> str:
    """Resolve a stored image URL into something an email client can fetch.

    - Already-absolute URLs (`http://`, `https://`, `data:`) are returned as-is.
    - Backend-hosted paths (`/media/...`) are prefixed with PUBLIC_BASE_URL.
    - Anything else falls back to a 1×1 transparent gif so the layout doesn't
      blow up when an image is missing.
    """
    if not raw:
        return "https://boteakelegans.com/transparent.gif"
    if raw.startswith("http://") or raw.startswith("https://") or raw.startswith("data:"):
        return raw
    base = (settings.PUBLIC_BASE_URL or "https://boteakelegans.com").rstrip("/")
    if raw.startswith("/"):
        return f"{base}{raw}"
    return f"{base}/{raw}"


def _format_htg(amount) -> str:
    try:
        n = Decimal(amount)
    except Exception:
        return f"{amount}"
    # 2 500.00 → 2 500 (no cents on whole HTG amounts; otherwise keep 2 decimals)
    if n == n.to_integral_value():
        return f"{int(n):,}".replace(",", " ")
    return f"{n:,.2f}".replace(",", " ").replace(".", ",")


def _build_order_email_html(order: Order) -> str:
    """
    Branded HTML receipt. Inline styles only — most email clients strip
    <style> tags and don't support modern selectors. Tables for layout
    so Outlook stays happy. Max 600px width.
    """
    rows_html = []
    for it in order.items:
        opts: list[str] = []
        if it.size_label:
            opts.append(f"Taille : <strong>{it.size_label}</strong>")
        if it.color_label:
            opts.append(f"Couleur : <strong>{it.color_label}</strong>")
        opts_html = "<br>".join(opts)
        line_total = Decimal(it.unit_price) * Decimal(it.quantity)
        rows_html.append(
            f"""
            <tr>
              <td style="padding:14px 0;border-bottom:1px solid #ECE5DA;vertical-align:top;width:84px;">
                <img src="{_abs_image_url(it.image_url)}" alt="" width="72" height="72"
                  style="display:block;width:72px;height:72px;object-fit:cover;border:1px solid #ECE5DA;" />
              </td>
              <td style="padding:14px 12px;border-bottom:1px solid #ECE5DA;vertical-align:top;font-family:'Helvetica Neue',Arial,sans-serif;font-size:14px;color:#2A211C;">
                <div style="font-weight:600;">{it.product_name}</div>
                {f'<div style="font-size:12px;color:#7A6F62;margin-top:4px;">{opts_html}</div>' if opts_html else ''}
                <div style="font-size:12px;color:#7A6F62;margin-top:4px;">Quantité : {it.quantity}</div>
              </td>
              <td style="padding:14px 0;border-bottom:1px solid #ECE5DA;vertical-align:top;text-align:right;font-family:'Helvetica Neue',Arial,sans-serif;font-size:14px;color:#2A211C;white-space:nowrap;">
                ${line_total:.2f}
              </td>
            </tr>
            """
        )
    items_html = "".join(rows_html) if rows_html else (
        '<tr><td colspan="3" style="padding:20px;text-align:center;color:#7A6F62;">Aucun article</td></tr>'
    )

    if order.delivery_requested:
        if Decimal(order.delivery_fee) > 0:
            delivery_row = f"""
            <tr>
              <td style="padding:6px 0;color:#7A6F62;font-size:14px;">Livraison à domicile</td>
              <td style="padding:6px 0;text-align:right;font-size:14px;color:#2A211C;">{_format_htg(order.delivery_fee)} {order.currency}</td>
            </tr>"""
        else:
            delivery_row = """
            <tr>
              <td style="padding:6px 0;color:#7A6F62;font-size:14px;">Livraison à domicile</td>
              <td style="padding:6px 0;text-align:right;font-size:14px;color:#2E7D32;">offerte</td>
            </tr>"""
    else:
        delivery_row = """
        <tr>
          <td style="padding:6px 0;color:#7A6F62;font-size:14px;">Retrait sur place</td>
          <td style="padding:6px 0;text-align:right;font-size:14px;color:#7A6F62;">—</td>
        </tr>"""

    subtotal_str = _format_htg(order.subtotal) if order.subtotal else _format_htg(order.total_amount)

    return f"""<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Commande {order.order_number}</title>
</head>
<body style="margin:0;padding:0;background:#FAF6F0;font-family:'Helvetica Neue',Arial,sans-serif;color:#2A211C;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#FAF6F0;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;background:#FFFFFF;border:1px solid #ECE5DA;">
          <!-- Brand header -->
          <tr>
            <td align="center" style="padding:32px 24px 20px 24px;border-bottom:1px solid #ECE5DA;">
              <div style="font-family:Georgia,'Times New Roman',serif;font-size:26px;letter-spacing:0.04em;color:#2A211C;">
                Beauté <span style="color:#A03D33;font-style:italic;">&amp;</span> <span style="font-style:italic;">Élégance</span>
              </div>
              <div style="margin-top:6px;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#7A6F62;">
                Bijoux · Parfums · Beauté
              </div>
            </td>
          </tr>

          <!-- Confirmation banner -->
          <tr>
            <td style="padding:28px 32px 8px 32px;">
              <p style="margin:0 0 4px 0;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#A03D33;">
                Commande confirmée
              </p>
              <h1 style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:24px;font-weight:500;color:#2A211C;">
                Merci {order.customer_name},
              </h1>
              <p style="margin:8px 0 0 0;font-size:14px;line-height:1.5;color:#54483D;">
                Votre paiement a bien été reçu. Nous préparons votre commande
                <strong style="color:#2A211C;">#{order.order_number}</strong>
                avec soin.
              </p>
            </td>
          </tr>

          <!-- Items -->
          <tr>
            <td style="padding:20px 32px 0 32px;">
              <p style="margin:0 0 8px 0;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#7A6F62;">
                Vos articles
              </p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                {items_html}
              </table>
            </td>
          </tr>

          <!-- Totals -->
          <tr>
            <td style="padding:20px 32px 12px 32px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="padding:6px 0;color:#7A6F62;font-size:14px;">Sous-total</td>
                  <td style="padding:6px 0;text-align:right;font-size:14px;color:#2A211C;">{subtotal_str} {order.currency}</td>
                </tr>
                {delivery_row}
                <tr>
                  <td style="padding:14px 0 0 0;border-top:1px solid #ECE5DA;font-family:Georgia,'Times New Roman',serif;font-size:16px;color:#2A211C;">
                    Total payé
                  </td>
                  <td style="padding:14px 0 0 0;border-top:1px solid #ECE5DA;text-align:right;font-family:Georgia,'Times New Roman',serif;font-size:18px;color:#A03D33;">
                    {_format_htg(order.total_amount)} {order.currency}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Shipping address -->
          <tr>
            <td style="padding:8px 32px 24px 32px;">
              <p style="margin:0 0 6px 0;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#7A6F62;">
                Adresse de livraison
              </p>
              <div style="font-size:14px;line-height:1.5;color:#2A211C;">
                <strong>{order.customer_name}</strong><br>
                {order.customer_address}<br>
                {order.customer_city}<br>
                <span style="color:#7A6F62;">{order.customer_phone}</span>
              </div>
            </td>
          </tr>

          <!-- Help -->
          <tr>
            <td style="padding:0 32px 24px 32px;">
              <div style="border-top:1px solid #ECE5DA;padding-top:20px;font-size:13px;line-height:1.6;color:#54483D;">
                Une question sur votre commande ? Répondez simplement à ce message
                ou écrivez-nous à
                <a href="mailto:boteakelegans@boteakelegans.com"
                   style="color:#A03D33;text-decoration:none;">boteakelegans@boteakelegans.com</a>.
                Vous pouvez aussi nous joindre sur WhatsApp au
                <a href="https://wa.me/50934705170" style="color:#A03D33;text-decoration:none;">+509 3470 5170</a>.
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding:20px 32px 28px 32px;background:#FAF6F0;border-top:1px solid #ECE5DA;">
              <div style="font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#A03D33;">
                Beauté &amp; Élégance
              </div>
              <div style="margin-top:4px;font-size:11px;color:#7A6F62;">
                Delmas · Port-au-Prince · Haïti
              </div>
            </td>
          </tr>
        </table>
        <p style="margin:14px 0 0 0;font-size:11px;color:#7A6F62;">
          Vous recevez ce message parce qu'une commande a été passée avec votre adresse email.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>"""


def _send_order_confirmation(order: Order) -> None:
    """Branded HTML receipt (with plain-text fallback) sent to the
    customer once a MonCash payment settles. Best-effort: callers wrap
    us in a try/except so SMTP issues don't roll back payment status."""
    if not order.customer_email:
        return

    # Plain-text fallback — preserved verbatim for clients that don't
    # render HTML (and as the multipart/alternative requires it).
    items_lines = []
    for it in order.items:
        bits = [f"  - {it.quantity}× {it.product_name}"]
        if it.size_label:
            bits.append(f"taille {it.size_label}")
        if it.color_label:
            bits.append(f"couleur {it.color_label}")
        bits.append(f"(${Decimal(it.unit_price) * Decimal(it.quantity):.2f})")
        items_lines.append(" — ".join(bits))
    items_text = "\n".join(items_lines) if items_lines else "(aucun article)"

    if order.delivery_requested:
        delivery_line = (
            f"Livraison : {order.delivery_fee} {order.currency}"
            if Decimal(order.delivery_fee) > 0
            else "Livraison : offerte"
        )
    else:
        delivery_line = "Livraison : à récupérer sur place"

    body_text = (
        f"Bonjour {order.customer_name},\n\n"
        f"Merci pour votre commande chez Beauté & Élégance.\n\n"
        f"Numéro de commande : {order.order_number}\n"
        f"Statut : payée\n\n"
        f"Articles :\n{items_text}\n\n"
        f"Sous-total : {order.subtotal} {order.currency}\n"
        f"{delivery_line}\n"
        f"Total payé : {order.total_amount} {order.currency}\n\n"
        f"Adresse de livraison :\n"
        f"  {order.customer_address}\n"
        f"  {order.customer_city}\n\n"
        "Nous préparons votre commande. Vous recevrez un nouveau message "
        "lorsqu'elle sera expédiée.\n\n"
        "Pour toute question, écrivez à boteakelegans@boteakelegans.com "
        "ou répondez à ce message.\n\n"
        "— L'équipe Beauté & Élégance"
    )

    send_email(
        to=order.customer_email,
        subject=f"Beauté & Élégance — Commande {order.order_number} confirmée",
        body_text=body_text,
        body_html=_build_order_email_html(order),
    )


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


def _compute_delivery_fee(
    subtotal: Decimal,
    fee: Decimal,
    threshold: Decimal,
) -> Decimal:
    if subtotal >= threshold:
        return Decimal("0")
    return fee


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

        repo = SettingRepository(self.repo.db)
        rate = repo.get_exchange_rate()
        subtotal_htg = (subtotal_usd * rate).quantize(Decimal("0.01"))

        delivery_fee = Decimal("0")
        if data.delivery_requested:
            # Delivery is now offered in any city. Fee + free-delivery
            # threshold come from app_settings so the super_admin can edit
            # them at runtime.
            delivery_fee = _compute_delivery_fee(
                subtotal_htg,
                fee=repo.get_delivery_fee_htg(),
                threshold=repo.get_free_delivery_threshold_htg(),
            )

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
            elif product.stock < it.quantity:
                raise OutOfStockException(
                    detail=f"Only {product.stock} unit(s) of '{product.name}' available"
                )

            color_label = None
            if product.has_colors:
                if it.product_color_id is None:
                    raise BaseAPIException(
                        detail=f"A color is required for '{product.name}'"
                    )
                color = self.product_repo.get_color(it.product_color_id)
                if not color or color.product_id != product.id or not color.is_active:
                    raise NotFoundException(detail="Color not found for this product")
                if color.stock < it.quantity:
                    raise OutOfStockException(
                        detail=f"Only {color.stock} unit(s) available in {color.color_label}"
                    )
                color_label = color.color_label

            unit_price = Decimal(product.price)
            total += unit_price * it.quantity

            items.append(
                OrderItem(
                    product_id=product.id,
                    product_size_id=it.product_size_id,
                    product_color_id=it.product_color_id,
                    product_name=product.name,
                    size_label=size_label,
                    color_label=color_label,
                    image_url=product.image_url,
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

    def recover_moncash_by_order_number(self, order_number: str) -> Order:
        """
        Last-resort recovery path: the customer was redirected back without
        any `transactionId` in the URL (Digicel sometimes drops it). We have
        the order_number stashed locally — ask MonCash directly via
        RetrieveOrderPayment to look up the transaction and finalise.
        """
        order = self.repo.get_by_order_number(order_number)
        if not order:
            raise NotFoundException(detail=f"Order '{order_number}' not found")

        try:
            data = self.moncash.retrieve_order(order_number)
        except MonCashError as exc:
            raise BaseAPIException(detail=str(exc))

        payment_obj = data.get("payment", data) or {}
        transaction_id = (
            payment_obj.get("transaction_id")
            or payment_obj.get("transactionId")
        )
        if not transaction_id:
            # MonCash knows about no settled transaction for this order yet —
            # the customer probably abandoned the payment. Leave order pending.
            raise NotFoundException(
                detail="Aucune transaction MonCash trouvée pour cette commande."
            )

        return self._apply_verification(order, str(transaction_id), data)

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
                if item.product_color_id is not None:
                    self.product_repo.decrement_color_stock(item.product_color_id, item.quantity)

            updated = self.repo.update_fields(
                order.id,
                {
                    "status": ORDER_STATUS_PAID,
                    "payment_status": PAYMENT_STATUS_SUCCESS,
                    "payment_reference": transaction_id,
                },
            )

            # Best-effort email receipt to the customer. Never let an SMTP
            # error roll back the payment confirmation — we log and move on.
            if updated and updated.customer_email:
                try:
                    _send_order_confirmation(updated)
                except Exception:
                    import logging
                    logging.getLogger(__name__).exception(
                        "Failed to send order confirmation email for %s", updated.order_number
                    )

            return updated
        else:
            return self.repo.update_fields(
                order.id,
                {"payment_status": PAYMENT_STATUS_FAILED},
            )
