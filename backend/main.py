import logging
from contextlib import asynccontextmanager

from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.openapi.utils import get_openapi
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from slowapi.util import get_remote_address

import models.user     # noqa: F401 — register models for create_all
import models.rbac     # noqa: F401 — register RBAC models for create_all
import models.catalog  # noqa: F401 — register catalog models for create_all
import models.order    # noqa: F401 — register order/payment models for create_all
import models.stock    # noqa: F401 — register stock receipts table
import models.setting  # noqa: F401 — register app_settings (e.g. exchange rate)
from core.config import settings
from core.exceptions import BaseAPIException, api_exception_handler
from core.middleware import SecurityHeadersMiddleware
from database import Base, SessionLocal, engine
from routers import (
    auth_router,
    category_router,
    media_router,
    order_router,
    product_router,
    setting_router,
    stock_router,
    user_router,
)

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# RBAC auto-seed helper
# ---------------------------------------------------------------------------
def _seed_rbac_if_needed() -> None:
    """Populate roles/permissions tables on first startup (idempotent)."""
    from scripts.seed_rbac import seed as _seed_rbac

    db = SessionLocal()
    try:
        _seed_rbac(db)
    except Exception:
        logger.exception("RBAC seed failed — permissions will fall back to built-in defaults")
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Lifespan — runs once at startup and once at shutdown
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    Base.metadata.create_all(bind=engine)
    _seed_rbac_if_needed()
    yield
    # Shutdown (nothing to clean up)


# ---------------------------------------------------------------------------
# Rate limiter
# ---------------------------------------------------------------------------
limiter = Limiter(key_func=get_remote_address, default_limits=["200/minute"])

# ---------------------------------------------------------------------------
# OpenAPI tag metadata (controls order and descriptions in Swagger UI)
# ---------------------------------------------------------------------------
TAGS_METADATA = [
    {
        "name": "auth",
        "description": (
            "Authentication endpoints. "
            "Use **POST /token** to obtain an access token + refresh token. "
            "Pass the access token as `Bearer <token>` in the `Authorization` header. "
            "Use **POST /token/refresh** to rotate the access token without re-logging in."
        ),
    },
    {
        "name": "users",
        "description": (
            "User management. "
            "**RBAC permissions required** — see each endpoint's summary for the needed permission. "
            "\n\n| Role | Permissions |\n|---|---|\n"
            "| `admin` | Full access |\n"
            "| `manager` | Read, list, update self |\n"
            "| `staff` | Read self, update self |"
        ),
    },
    {
        "name": "categories",
        "description": "Catalog categories (homme / femme), with optional parent for hierarchy. Public reads, admin writes.",
    },
    {
        "name": "products",
        "description": (
            "Product catalog. Public reads (storefront), admin writes. "
            "Each product has a `status` (`available` | `coming_soon`) and an optional "
            "list of `sizes` (used for rings — one row per finger size)."
        ),
    },
    {
        "name": "orders",
        "description": (
            "Customer orders & payments. Guests can checkout. "
            "Payments use **MonCash** (Digicel mobile money)."
        ),
    },
    {
        "name": "monitoring",
        "description": "Health check and operational endpoints.",
    },
]

# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------
app = FastAPI(
    lifespan=lifespan,
    title=settings.PROJECT_NAME,
    version="1.0.0",
    description=(
        "## Secure base system API\n\n"
        "### Authentication flow\n"
        "1. `POST /token` with `username` + `password` (form-data) → receive `access_token` & `refresh_token`\n"
        "2. Click **Authorize** (🔒) above and enter: `Bearer <access_token>`\n"
        "3. All protected endpoints will include the token automatically\n"
        "4. When the access token expires, call `POST /token/refresh` to get a new one\n\n"
        "### RBAC roles\n"
        "| Role | Description |\n|---|---|\n"
        "| `admin` | Full access to all resources |\n"
        "| `manager` | Read + list users, update own profile |\n"
        "| `staff` | Read + update own profile only |\n\n"
        "### Security features\n"
        "- JWT access tokens (30 min) + refresh tokens (7 days)\n"
        "- Account lockout after 5 failed login attempts\n"
        "- bcrypt password hashing\n"
        "- Rate limiting: 200 req/min per IP\n"
        "- Security headers on every response\n"
    ),
    openapi_tags=TAGS_METADATA,
    # Uncomment the two lines below to disable docs in production:
    # docs_url=None,
    # redoc_url=None,
    swagger_ui_parameters={
        "persistAuthorization": True,       # keep the token across page reloads
        "displayRequestDuration": True,     # show request timing in the UI
        "filter": True,                     # add a search box over endpoints
        "syntaxHighlight.theme": "monokai",
    },
    license_info={
        "name": "Private — All Rights Reserved",
    },
)

# Attach rate-limiter state so SlowAPIMiddleware can find it
app.state.limiter = limiter

# ---------------------------------------------------------------------------
# Middleware — order matters: first added = outermost
# ---------------------------------------------------------------------------

# 1. Trusted hosts — rejects requests with unexpected Host headers
app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=settings.allowed_hosts_list,
)

# 2. CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
    max_age=600,
)

# 3. Security headers on every response
app.add_middleware(SecurityHeadersMiddleware)

# 4. Rate limiting
app.add_middleware(SlowAPIMiddleware)

# ---------------------------------------------------------------------------
# Exception handlers
# ---------------------------------------------------------------------------
app.add_exception_handler(BaseAPIException, api_exception_handler)
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled exception on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content={"detail": "An unexpected error occurred. Please try again later."},
    )


# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------
app.include_router(user_router.router)
app.include_router(auth_router.router)
app.include_router(category_router.router)
app.include_router(product_router.router)
app.include_router(order_router.router)
app.include_router(stock_router.router)
app.include_router(setting_router.router)
app.include_router(media_router.router)

# Serve uploaded images
_uploads_dir = Path(__file__).resolve().parent / "uploads"
_uploads_dir.mkdir(exist_ok=True)
app.mount("/media", StaticFiles(directory=str(_uploads_dir)), name="media")


# ---------------------------------------------------------------------------
# Core endpoints
# ---------------------------------------------------------------------------
@app.get("/", include_in_schema=False)
def read_root():
    return {"message": f"Welcome to {settings.PROJECT_NAME}"}


@app.get("/health", tags=["monitoring"], summary="Health check")
def health_check():
    """Returns `ok` when the service is running and reachable."""
    return {"status": "ok"}


# ---------------------------------------------------------------------------
# Customise the OpenAPI schema to add global security + better error models
# ---------------------------------------------------------------------------
def custom_openapi():
    if app.openapi_schema:
        return app.openapi_schema

    schema = get_openapi(
        title=app.title,
        version=app.version,
        description=app.description,
        routes=app.routes,
        tags=TAGS_METADATA,
    )

    # Ensure the BearerAuth security scheme is present
    schema.setdefault("components", {}).setdefault("securitySchemes", {})
    schema["components"]["securitySchemes"]["BearerAuth"] = {
        "type": "http",
        "scheme": "bearer",
        "bearerFormat": "JWT",
        "description": "Paste your access token here (without the 'Bearer' prefix).",
    }

    # Apply BearerAuth globally to every operation that doesn't opt out
    for path_item in schema.get("paths", {}).values():
        for operation in path_item.values():
            if isinstance(operation, dict):
                # Skip the token endpoint itself
                if "token" not in str(operation.get("operationId", "")):
                    operation.setdefault("security", [{"BearerAuth": []}])

    app.openapi_schema = schema
    return schema


app.openapi = custom_openapi
