"""
File upload endpoint.

Stores incoming images on the local filesystem at `backend/uploads/`
and returns a public URL like `/media/<filename>`. The same directory
is mounted as a StaticFiles route in `main.py`, so the returned URL
can be embedded directly as `<img src=...>`.

Restricted to users with `products:create` (admins / managers) so only
catalog editors can fill the disk.
"""
from __future__ import annotations

import os
import secrets
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status

from core.rbac import Permission, require_permission

router = APIRouter(prefix="/media", tags=["media"])


# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

BACKEND_DIR = Path(__file__).resolve().parent.parent
UPLOAD_DIR = BACKEND_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

ALLOWED_MIME = {
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
}
MAX_BYTES = 5 * 1024 * 1024  # 5 MB


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------

@router.post(
    "/upload",
    summary="Upload an image (admin / manager)",
    description=(
        "Uploads a single image (JPEG, PNG, WebP, GIF, max 5 MB) and returns "
        "a publicly servable URL. **Permission required:** `products:create`."
    ),
    dependencies=[Depends(require_permission(Permission.PRODUCTS_CREATE))],
)
async def upload_image(file: UploadFile = File(...)) -> dict[str, str]:
    if file.content_type not in ALLOWED_MIME:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=(
                f"Unsupported file type '{file.content_type}'. "
                f"Allowed: {', '.join(sorted(ALLOWED_MIME))}"
            ),
        )

    # Stream the file in chunks to enforce the size limit
    extension = ALLOWED_MIME[file.content_type]
    name = f"{secrets.token_urlsafe(16)}{extension}"
    target = UPLOAD_DIR / name
    written = 0
    with target.open("wb") as out:
        while chunk := await file.read(64 * 1024):
            written += len(chunk)
            if written > MAX_BYTES:
                out.close()
                try:
                    os.remove(target)
                except OSError:
                    pass
                raise HTTPException(
                    status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                    detail=f"File too large (max {MAX_BYTES // (1024 * 1024)} MB)",
                )
            out.write(chunk)

    return {
        "filename": name,
        "url": f"/media/{name}",
    }
