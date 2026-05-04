"""
Lightweight SMTP sender for transactional / contact-form emails.

Uses stdlib smtplib + email so we don't pull in another dependency. The
backend is meant to talk to a single SMTP relay (Hostinger by default,
but anything with TLS/SSL works) configured via env.
"""
from __future__ import annotations

import logging
import smtplib
from email.message import EmailMessage
from email.utils import formataddr

from core.config import settings


logger = logging.getLogger(__name__)


class EmailNotConfiguredError(RuntimeError):
    """Raised when an email send is attempted but SMTP_* env vars are blank."""


def _is_configured() -> bool:
    return bool(settings.SMTP_HOST and settings.SMTP_USER and settings.SMTP_PASSWORD)


def send_email(
    *,
    to: str,
    subject: str,
    body_text: str,
    body_html: str | None = None,
    reply_to: str | None = None,
) -> None:
    """
    Send an email through the configured SMTP relay.

    `body_text` is mandatory and used as the multipart/alternative
    plain-text fallback. When `body_html` is provided we attach an HTML
    alternative so clients that render HTML (most of them) get the rich
    version while text-only clients still receive a readable message.

    Raises EmailNotConfiguredError if SMTP_* settings are missing — callers
    can catch this and surface a softer message to end-users (e.g. fall
    back to "use WhatsApp instead").
    """
    if not _is_configured():
        raise EmailNotConfiguredError("SMTP_HOST / SMTP_USER / SMTP_PASSWORD are not set")

    msg = EmailMessage()
    msg["From"] = formataddr((settings.SMTP_FROM_NAME, settings.SMTP_USER))
    msg["To"] = to
    msg["Subject"] = subject
    if reply_to:
        msg["Reply-To"] = reply_to
    msg.set_content(body_text)
    if body_html:
        msg.add_alternative(body_html, subtype="html")

    if settings.SMTP_USE_SSL:
        with smtplib.SMTP_SSL(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15) as server:
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.send_message(msg)
    else:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15) as server:
            server.starttls()
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.send_message(msg)

    logger.info("Email sent to %s — subject %r", to, subject)
