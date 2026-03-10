from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status

from core.config import settings
from core.security import (
    create_access_token,
    create_refresh_token,
    decode_refresh_token,
    verify_password,
)
from repositories.user_repository import UserRepository


class AuthService:
    def __init__(self, user_repository: UserRepository):
        self.user_repository = user_repository

    def authenticate_user(self, username: str, password: str):
        user = self.user_repository.get_user_by_username(username=username)

        # Use a constant-time comparison path to avoid username enumeration
        if not user:
            # Still hash to consume similar time and not leak user existence
            verify_password(password, "$2b$12$notavalidhashbutenoughcharstowork000000000000000000000")
            return False

        # Check account lock
        if user.locked_until and user.locked_until > datetime.now(timezone.utc):
            raise HTTPException(
                status_code=status.HTTP_423_LOCKED,
                detail=(
                    f"Account locked until "
                    f"{user.locked_until.strftime('%Y-%m-%d %H:%M UTC')}. "
                    "Contact support if you need immediate access."
                ),
            )

        if not verify_password(password, user.hashed_password):
            new_attempts = user.failed_login_attempts + 1
            if new_attempts >= settings.MAX_LOGIN_ATTEMPTS:
                locked_until = datetime.now(timezone.utc) + timedelta(
                    minutes=settings.ACCOUNT_LOCKOUT_MINUTES
                )
                self.user_repository.lock_user(user.id, locked_until, reset_attempts=0)
            else:
                self.user_repository.update_failed_attempts(user.id, new_attempts)
            return False

        # Reset failed counter on successful auth
        if user.failed_login_attempts > 0:
            self.user_repository.update_failed_attempts(user.id, 0)

        return user

    def login_access_token(self, form_data):
        user = self.authenticate_user(form_data.username, form_data.password)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect username or password",
                headers={"WWW-Authenticate": "Bearer"},
            )
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Account is disabled",
            )

        from core.rbac import get_role_permissions
        permissions = sorted(get_role_permissions(user.role))

        access_token = create_access_token(
            data={
                "sub": user.username,
                "role": user.role,
                "permissions": permissions,
            },
            expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
        )
        refresh_token = create_refresh_token(data={"sub": user.username})
        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
        }

    def refresh_access_token(self, refresh_token: str) -> dict:
        token_data = decode_refresh_token(refresh_token)
        if not token_data:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired refresh token",
                headers={"WWW-Authenticate": "Bearer"},
            )
        user = self.user_repository.get_user_by_username(username=token_data.username)
        if not user or not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found or account disabled",
            )
        from core.rbac import get_role_permissions
        permissions = sorted(get_role_permissions(user.role))

        access_token = create_access_token(
            data={
                "sub": user.username,
                "role": user.role,
                "permissions": permissions,
            },
            expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
        )
        return {"access_token": access_token, "token_type": "bearer"}
