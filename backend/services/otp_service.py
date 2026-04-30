"""
Two-factor login for admin / super_admin accounts.

Flow:
1. User submits username+password to /token. AuthService validates them
   and, if the role is privileged, hands off to OtpService.start() which
   generates a 6-digit code, hashes it, persists a challenge row, and
   emails the code. The browser receives an opaque challenge_id (no
   tokens yet).
2. User enters the code at /token/verify-otp. OtpService.verify() checks
   the code, deletes the challenge, and returns real JWT tokens.
3. User can request a new code via /token/resend-otp; we throttle that
   to once per RESEND_COOLDOWN_SECONDS to avoid burning Hostinger quota.
"""
from __future__ import annotations

import logging
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status

from core.security import get_password_hash, verify_password
from models.otp_challenge import OtpChallenge
from models.user import User
from repositories.otp_repository import OtpRepository
from services.email_service import EmailNotConfiguredError, send_email


logger = logging.getLogger(__name__)


OTP_TTL_MINUTES = 10
OTP_MAX_ATTEMPTS = 5
RESEND_COOLDOWN_SECONDS = 60
PRIVILEGED_ROLES = {"super_admin", "admin"}


def role_requires_otp(role: str | None) -> bool:
    return (role or "") in PRIVILEGED_ROLES


def _generate_code() -> str:
    """Cryptographically random 6-digit code, zero-padded."""
    return f"{secrets.randbelow(1_000_000):06d}"


def _mask_email(email: str) -> str:
    """Hide most of the local part for the OTP UI hint (`a***@gmail.com`)."""
    if "@" not in email:
        return "***"
    local, domain = email.split("@", 1)
    if len(local) <= 2:
        return f"{local[:1]}***@{domain}"
    return f"{local[0]}***{local[-1]}@{domain}"


def _send_code_email(user: User, code: str) -> None:
    subject = "Beauté & Élégance — Code de connexion administrateur"
    body = (
        f"Bonjour {user.username},\n\n"
        f"Votre code de connexion est :\n\n"
        f"    {code}\n\n"
        f"Il expire dans {OTP_TTL_MINUTES} minutes.\n\n"
        "Si vous n'êtes pas à l'origine de cette tentative, ignorez ce "
        "message et changez votre mot de passe immédiatement.\n\n"
        "— Beauté & Élégance"
    )
    send_email(to=user.email, subject=subject, body_text=body)


class OtpService:
    def __init__(self, otp_repo: OtpRepository):
        self.repo = otp_repo

    def start(self, user: User) -> dict:
        """Issue a fresh OTP for `user` and email it. Returns the opaque
        challenge_id the frontend must echo back when verifying."""
        code = _generate_code()
        try:
            _send_code_email(user, code)
        except EmailNotConfiguredError:
            logger.error("OTP requested for %s but SMTP is not configured", user.username)
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="L'authentification à deux facteurs est temporairement indisponible.",
            )
        except Exception:
            logger.exception("OTP email failed to send for %s", user.username)
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Impossible d'envoyer le code par email. Réessayez dans un instant.",
            )

        challenge = OtpChallenge(
            id=secrets.token_urlsafe(32),
            user_id=user.id,
            code_hash=get_password_hash(code),
            expires_at=datetime.now(timezone.utc) + timedelta(minutes=OTP_TTL_MINUTES),
        )
        self.repo.create(challenge)

        return {
            "otp_required": True,
            "challenge_id": challenge.id,
            "email_hint": _mask_email(user.email),
            "expires_in_seconds": OTP_TTL_MINUTES * 60,
        }

    def verify(self, challenge_id: str, code: str) -> User:
        """Returns the User on success, raises HTTPException otherwise."""
        challenge = self.repo.get_by_id(challenge_id)
        now = datetime.now(timezone.utc)
        if not challenge:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Code invalide ou expiré. Reconnectez-vous.",
            )
        if challenge.expires_at < now:
            self.repo.delete(challenge_id)
            raise HTTPException(
                status_code=status.HTTP_410_GONE,
                detail="Le code a expiré. Reconnectez-vous pour en recevoir un nouveau.",
            )
        if challenge.attempts >= OTP_MAX_ATTEMPTS:
            self.repo.delete(challenge_id)
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Trop de tentatives. Reconnectez-vous pour en recevoir un nouveau.",
            )

        if not verify_password(code, challenge.code_hash):
            remaining = OTP_MAX_ATTEMPTS - self.repo.increment_attempts(challenge_id)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=(
                    f"Code incorrect. Il vous reste {max(0, remaining)} tentative(s)."
                    if remaining > 0
                    else "Code incorrect. Reconnectez-vous pour en recevoir un nouveau."
                ),
            )

        # Success — load the user (challenge has user_id) and burn the challenge
        from repositories.user_repository import UserRepository
        user = UserRepository(self.repo.db).get_user_by_id(challenge.user_id)
        self.repo.delete(challenge_id)
        if not user or not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Compte introuvable ou désactivé.",
            )
        return user

    def resend(self, challenge_id: str) -> dict:
        challenge = self.repo.get_by_id(challenge_id)
        if not challenge:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Session expirée. Reconnectez-vous.",
            )
        now = datetime.now(timezone.utc)
        elapsed = (now - challenge.last_sent_at).total_seconds()
        if elapsed < RESEND_COOLDOWN_SECONDS:
            wait = int(RESEND_COOLDOWN_SECONDS - elapsed)
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Patientez {wait}s avant de redemander un code.",
            )

        user = self.repo.db.query(User).filter(User.id == challenge.user_id).first()
        if not user or not user.is_active:
            self.repo.delete(challenge_id)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Compte introuvable ou désactivé.",
            )

        code = _generate_code()
        try:
            _send_code_email(user, code)
        except EmailNotConfiguredError:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="L'authentification à deux facteurs est temporairement indisponible.",
            )
        except Exception:
            logger.exception("OTP resend email failed for %s", user.username)
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Impossible d'envoyer le code par email. Réessayez dans un instant.",
            )

        self.repo.update_code(
            challenge_id,
            get_password_hash(code),
            now + timedelta(minutes=OTP_TTL_MINUTES),
        )

        return {
            "ok": True,
            "expires_in_seconds": OTP_TTL_MINUTES * 60,
        }
