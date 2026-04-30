from fastapi import APIRouter, Depends, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from database import get_db
from dtos.token import (
    AccessToken,
    LoginResponse,
    OtpResendRequest,
    OtpVerifyRequest,
    RefreshTokenRequest,
    Token,
)
from repositories.user_repository import UserRepository
from services.auth_service import AuthService

router = APIRouter(tags=["auth"])


def get_auth_service(db: Session = Depends(get_db)) -> AuthService:
    return AuthService(UserRepository(db))


@router.post(
    "/token",
    response_model=LoginResponse,
    summary="Login — issue tokens, or start an OTP challenge for admins",
    description=(
        "Authenticate with `username` and `password` (form-data, **not** JSON).\n\n"
        "Two response shapes:\n"
        "- **Regular users** receive `access_token` + `refresh_token` immediately.\n"
        "- **Admin / super_admin** receive `{otp_required, challenge_id, email_hint, expires_in_seconds}`. "
        "The 6-digit code is emailed; the client must call `POST /token/verify-otp` with "
        "`{challenge_id, code}` to obtain real tokens.\n\n"
        "**Brute-force protection:** account is locked for 15 minutes after 5 failed password attempts."
    ),
    responses={
        200: {"description": "Tokens issued, or OTP challenge started"},
        401: {"description": "Invalid credentials"},
        423: {"description": "Account temporarily locked"},
    },
)
async def login_for_access_token(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    service: AuthService = Depends(get_auth_service),
):
    return service.login_access_token(form_data)


@router.post(
    "/token/verify-otp",
    response_model=Token,
    summary="Verify the 6-digit OTP and finalise admin login",
    responses={
        200: {"description": "Tokens issued"},
        401: {"description": "Wrong code (counts towards 5-attempt cap)"},
        404: {"description": "Challenge unknown — restart login"},
        410: {"description": "Code expired — restart login"},
        429: {"description": "Too many wrong attempts — restart login"},
    },
)
async def verify_otp(
    body: OtpVerifyRequest,
    service: AuthService = Depends(get_auth_service),
):
    return service.verify_otp_and_login(body.challenge_id, body.code)


@router.post(
    "/token/resend-otp",
    summary="Re-send the OTP for an in-flight admin login",
    responses={
        200: {"description": "New code sent"},
        404: {"description": "Challenge unknown — restart login"},
        429: {"description": "Wait before requesting another code"},
    },
)
async def resend_otp(
    body: OtpResendRequest,
    service: AuthService = Depends(get_auth_service),
):
    return service.resend_otp(body.challenge_id)


@router.post(
    "/token/refresh",
    response_model=AccessToken,
    summary="Refresh — exchange a refresh token for a new access token",
    description=(
        "Send a valid `refresh_token` in the JSON body to receive a fresh `access_token`.\n\n"
        "The refresh token itself is **not** rotated — it remains valid until it expires (7 days)."
    ),
    responses={
        200: {"description": "New access token issued"},
        401: {"description": "Refresh token invalid or expired"},
    },
)
async def refresh_access_token(
    body: RefreshTokenRequest,
    service: AuthService = Depends(get_auth_service),
):
    return service.refresh_access_token(body.refresh_token)
