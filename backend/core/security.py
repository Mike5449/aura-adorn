from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from core.config import settings
from database import get_db
from dtos.token import TokenData

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=15))
    to_encode.update({"exp": expire, "type": "access"})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def create_refresh_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire, "type": "refresh"})
    return jwt.encode(to_encode, settings.REFRESH_SECRET_KEY, algorithm=settings.ALGORITHM)


def _decode_access_token(token: str) -> Optional[TokenData]:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        if payload.get("type") != "access":
            return None
        username: str = payload.get("sub")
        if not username:
            return None
        return TokenData(
            username=username,
            role=payload.get("role"),
            permissions=payload.get("permissions", []),
        )
    except JWTError:
        return None


def decode_refresh_token(token: str) -> Optional[TokenData]:
    try:
        payload = jwt.decode(token, settings.REFRESH_SECRET_KEY, algorithms=[settings.ALGORITHM])
        if payload.get("type") != "refresh":
            return None
        username: str = payload.get("sub")
        if not username:
            return None
        return TokenData(username=username)
    except JWTError:
        return None


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    token_data = _decode_access_token(token)
    if token_data is None:
        raise credentials_exception

    # Import here to avoid circular imports
    from repositories.user_repository import UserRepository

    user = UserRepository(db).get_user_by_username(username=token_data.username)
    if user is None:
        raise credentials_exception
    return user


async def get_current_active_user(current_user=Depends(get_current_user)):
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive account",
        )
    return current_user


# OAuth2 scheme variant that does not auto-error when the header is missing —
# used for guest-friendly endpoints (e.g. checkout) that should accept both
# anonymous and authenticated callers.
_oauth2_optional = OAuth2PasswordBearer(tokenUrl="token", auto_error=False)


async def get_current_active_user_optional(
    token: Optional[str] = Depends(_oauth2_optional),
    db: Session = Depends(get_db),
):
    if not token:
        return None
    token_data = _decode_access_token(token)
    if token_data is None:
        return None
    from repositories.user_repository import UserRepository

    user = UserRepository(db).get_user_by_username(username=token_data.username)
    if user is None or not user.is_active:
        return None
    return user


def require_role(*roles: str):
    """Factory that returns a dependency enforcing one of the given roles."""

    async def _checker(current_user=Depends(get_current_active_user)):
        if current_user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions",
            )
        return current_user

    return _checker
