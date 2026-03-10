from fastapi import Request, status
from fastapi.responses import JSONResponse


class BaseAPIException(Exception):
    status_code: int = status.HTTP_500_INTERNAL_SERVER_ERROR
    detail: str = "Internal Server Error"

    def __init__(self, detail: str = None):
        if detail:
            self.detail = detail


class NotFoundException(BaseAPIException):
    status_code = status.HTTP_404_NOT_FOUND
    detail = "Resource not found"


class UserAlreadyExistsException(BaseAPIException):
    status_code = status.HTTP_409_CONFLICT
    detail = "User already exists"


class UnauthorizedException(BaseAPIException):
    status_code = status.HTTP_401_UNAUTHORIZED
    detail = "Authentication required"


class ForbiddenException(BaseAPIException):
    status_code = status.HTTP_403_FORBIDDEN
    detail = "Insufficient permissions"


class AccountLockedException(BaseAPIException):
    status_code = status.HTTP_423_LOCKED
    detail = "Account temporarily locked due to too many failed login attempts"


def api_exception_handler(request: Request, exc: BaseAPIException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
    )
