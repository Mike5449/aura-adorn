from fastapi import APIRouter, Depends, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from database import get_db
from dtos.token import AccessToken, RefreshTokenRequest, Token
from repositories.user_repository import UserRepository
from services.auth_service import AuthService

router = APIRouter(tags=["auth"])


def get_auth_service(db: Session = Depends(get_db)) -> AuthService:
    return AuthService(UserRepository(db))


@router.post(
    "/token",
    response_model=Token,
    summary="Login — obtain access + refresh tokens",
    description=(
        "Authenticate with `username` and `password` (form-data, **not** JSON).\n\n"
        "Returns:\n"
        "- `access_token` — short-lived JWT (30 min by default). Use as `Authorization: Bearer <token>`.\n"
        "- `refresh_token` — long-lived JWT (7 days). Use at `POST /token/refresh` to rotate the access token.\n\n"
        "**Brute-force protection:** account is locked for 15 minutes after 5 failed attempts."
    ),
    responses={
        200: {"description": "Tokens issued successfully"},
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
