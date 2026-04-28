"""
Thin wrapper around the MonCash REST API.

MonCash is the Digicel mobile-money service used in Haiti.
Two environments are available — sandbox for testing, production for live payments.

Required configuration (read from env via core.config.settings):
- MONCASH_CLIENT_ID
- MONCASH_CLIENT_SECRET
- MONCASH_MODE          ("sandbox" | "production"; default: sandbox)
- MONCASH_RETURN_URL    (frontend URL the user lands on after paying)

API reference:
    https://moncashbutton.digicelgroup.com/Moncash-business/resources/AccessYourBusinessAccount
"""
from __future__ import annotations

import base64
import logging
from typing import Any, Optional

import httpx

from core.config import settings

logger = logging.getLogger(__name__)


SANDBOX_API_BASE = "https://sandbox.moncashbutton.digicelgroup.com/Api"
SANDBOX_GATEWAY_BASE = "https://sandbox.moncashbutton.digicelgroup.com/Moncash-middleware"
PROD_API_BASE = "https://moncashbutton.digicelgroup.com/Api"
PROD_GATEWAY_BASE = "https://moncashbutton.digicelgroup.com/Moncash-middleware"


class MonCashError(Exception):
    """Raised when a call to MonCash fails."""


class MonCashClient:
    def __init__(
        self,
        client_id: Optional[str] = None,
        client_secret: Optional[str] = None,
        mode: Optional[str] = None,
        timeout: float = 15.0,
    ) -> None:
        self.client_id = client_id or settings.MONCASH_CLIENT_ID
        self.client_secret = client_secret or settings.MONCASH_CLIENT_SECRET
        self.mode = (mode or settings.MONCASH_MODE or "sandbox").lower()
        self.timeout = timeout

        if self.mode == "production":
            self.api_base = PROD_API_BASE
            self.gateway_base = PROD_GATEWAY_BASE
        else:
            self.api_base = SANDBOX_API_BASE
            self.gateway_base = SANDBOX_GATEWAY_BASE

    # ---------------------------------------------------------------------
    # Auth
    # ---------------------------------------------------------------------
    def _get_access_token(self) -> str:
        if not self.client_id or not self.client_secret:
            raise MonCashError(
                "MONCASH_CLIENT_ID / MONCASH_CLIENT_SECRET are not configured"
            )

        creds = f"{self.client_id}:{self.client_secret}".encode("utf-8")
        encoded = base64.b64encode(creds).decode("ascii")

        try:
            with httpx.Client(timeout=self.timeout) as client:
                resp = client.post(
                    f"{self.api_base}/oauth/token",
                    headers={
                        "Authorization": f"Basic {encoded}",
                        "Accept": "application/json",
                    },
                    data={
                        "scope": "read,write",
                        "grant_type": "client_credentials",
                    },
                )
        except httpx.HTTPError as exc:
            raise MonCashError(f"Could not reach MonCash: {exc}") from exc

        if resp.status_code != 200:
            raise MonCashError(f"MonCash auth failed: {resp.status_code} {resp.text}")

        data = resp.json()
        token = data.get("access_token")
        if not token:
            raise MonCashError(f"MonCash auth: no access_token in response: {data}")
        return token

    # ---------------------------------------------------------------------
    # Create payment
    # ---------------------------------------------------------------------
    def create_payment(self, order_id: str, amount: float) -> dict[str, Any]:
        """
        Create a payment session. Returns the raw MonCash response
        plus a `redirect_url` the customer must open to complete payment.
        """
        token = self._get_access_token()

        try:
            with httpx.Client(timeout=self.timeout) as client:
                resp = client.post(
                    f"{self.api_base}/v1/CreatePayment",
                    headers={
                        "Authorization": f"Bearer {token}",
                        "Content-Type": "application/json",
                        "Accept": "application/json",
                    },
                    json={"amount": float(amount), "orderId": order_id},
                )
        except httpx.HTTPError as exc:
            raise MonCashError(f"MonCash CreatePayment unreachable: {exc}") from exc

        if resp.status_code not in (200, 202):
            raise MonCashError(
                f"MonCash CreatePayment failed: {resp.status_code} {resp.text}"
            )

        data = resp.json()
        # MonCash typically returns: {"payment_token": {"token": "...", "expired": "..."}, "mode": "..."}
        payment_token_obj = data.get("payment_token") or {}
        token_value = (
            payment_token_obj.get("token")
            if isinstance(payment_token_obj, dict)
            else payment_token_obj
        )
        if not token_value:
            raise MonCashError(f"MonCash CreatePayment: no token in response: {data}")

        redirect_url = f"{self.gateway_base}/Payment/Redirect?token={token_value}"
        return {
            "raw": data,
            "payment_token": token_value,
            "redirect_url": redirect_url,
        }

    # ---------------------------------------------------------------------
    # Verify a transaction (after the user returns from the gateway)
    # ---------------------------------------------------------------------
    def retrieve_transaction(self, transaction_id: str) -> dict[str, Any]:
        token = self._get_access_token()

        try:
            with httpx.Client(timeout=self.timeout) as client:
                resp = client.post(
                    f"{self.api_base}/v1/RetrieveTransactionPayment",
                    headers={
                        "Authorization": f"Bearer {token}",
                        "Content-Type": "application/json",
                        "Accept": "application/json",
                    },
                    json={"transactionId": transaction_id},
                )
        except httpx.HTTPError as exc:
            raise MonCashError(f"MonCash RetrieveTransaction unreachable: {exc}") from exc

        if resp.status_code != 200:
            raise MonCashError(
                f"MonCash RetrieveTransaction failed: {resp.status_code} {resp.text}"
            )

        return resp.json()

    def retrieve_order(self, order_id: str) -> dict[str, Any]:
        token = self._get_access_token()

        try:
            with httpx.Client(timeout=self.timeout) as client:
                resp = client.post(
                    f"{self.api_base}/v1/RetrieveOrderPayment",
                    headers={
                        "Authorization": f"Bearer {token}",
                        "Content-Type": "application/json",
                        "Accept": "application/json",
                    },
                    json={"orderId": order_id},
                )
        except httpx.HTTPError as exc:
            raise MonCashError(f"MonCash RetrieveOrder unreachable: {exc}") from exc

        if resp.status_code != 200:
            raise MonCashError(
                f"MonCash RetrieveOrder failed: {resp.status_code} {resp.text}"
            )

        return resp.json()
