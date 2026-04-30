"""
Public contact-form endpoint. Receives a message from the storefront,
forwards it to CONTACT_TO_EMAIL via SMTP. No auth, but rate-limited per
client IP and equipped with a honeypot to deflect basic bots.
"""
from __future__ import annotations

import logging
import time
from collections import defaultdict, deque
from threading import Lock

from fastapi import APIRouter, HTTPException, Request, status

from core.config import settings
from dtos.contact import ContactMessageCreate
from services.email_service import EmailNotConfiguredError, send_email


logger = logging.getLogger(__name__)
router = APIRouter(prefix="/contact", tags=["contact"])


# -- Rate limit: 3 messages per IP every 60 s, in-memory ----------------
_RATE_WINDOW = 60
_RATE_MAX = 3
_recent: dict[str, deque[float]] = defaultdict(deque)
_lock = Lock()


def _client_ip(request: Request) -> str:
    # Honor X-Forwarded-For from our reverse proxy (Caddy/nginx in front of FastAPI)
    forwarded = request.headers.get("x-forwarded-for", "")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _rate_limit_or_raise(ip: str) -> None:
    now = time.monotonic()
    with _lock:
        bucket = _recent[ip]
        while bucket and now - bucket[0] > _RATE_WINDOW:
            bucket.popleft()
        if len(bucket) >= _RATE_MAX:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Trop de messages envoyés. Réessayez dans une minute.",
            )
        bucket.append(now)


# -----------------------------------------------------------------------

@router.post("", status_code=status.HTTP_202_ACCEPTED)
def submit_contact_message(payload: ContactMessageCreate, request: Request) -> dict:
    # Honeypot: if the hidden `website` field was filled, silently 202 —
    # we do NOT tell the bot we saw it, but we don't send anything either.
    if payload.website.strip():
        logger.info("Honeypot triggered from %s", _client_ip(request))
        return {"status": "accepted"}

    _rate_limit_or_raise(_client_ip(request))

    to = settings.CONTACT_TO_EMAIL or settings.SMTP_USER
    if not to:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Le formulaire de contact est temporairement indisponible.",
        )

    subject = f"[Beauté & Élégance] Nouveau message — {payload.name}"
    body = (
        f"Nouveau message reçu depuis le site\n"
        f"------------------------------------\n\n"
        f"Nom    : {payload.name}\n"
        f"Email  : {payload.email}\n\n"
        f"Message :\n{payload.message}\n"
    )

    try:
        send_email(to=to, subject=subject, body_text=body, reply_to=payload.email)
    except EmailNotConfiguredError:
        # Don't leak config status to the client — return a soft error.
        logger.error("Contact form attempted but SMTP not configured")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Le formulaire de contact est temporairement indisponible.",
        )
    except Exception:
        logger.exception("SMTP send failed for contact message from %s", payload.email)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Échec de l'envoi du message. Réessayez plus tard ou utilisez WhatsApp.",
        )

    return {"status": "sent"}
