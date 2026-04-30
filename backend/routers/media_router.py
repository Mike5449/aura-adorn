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

import hashlib
import os
import tempfile
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

    extension = ALLOWED_MIME[file.content_type]

    # Stream into a temp file while computing SHA-256 of the content. Once we
    # know the hash we can name the final file <hash>.<ext>; if a file with
    # that name already exists we drop the temp (deduplication) and return
    # the existing URL. Otherwise we atomically move the temp into place.
    digest = hashlib.sha256()
    written = 0
    tmp_fd, tmp_path = tempfile.mkstemp(suffix=extension, dir=UPLOAD_DIR)
    try:
        with os.fdopen(tmp_fd, "wb") as out:
            while chunk := await file.read(64 * 1024):
                written += len(chunk)
                if written > MAX_BYTES:
                    raise HTTPException(
                        status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        detail=f"File too large (max {MAX_BYTES // (1024 * 1024)} MB)",
                    )
                digest.update(chunk)
                out.write(chunk)

        name = f"{digest.hexdigest()}{extension}"
        target = UPLOAD_DIR / name
        if target.exists():
            # Same content already on disk — drop the temp and reuse it.
            os.remove(tmp_path)
        else:
            os.replace(tmp_path, target)
    except Exception:
        try:
            os.remove(tmp_path)
        except OSError:
            pass
        raise

    return {
        "filename": name,
        "url": f"/media/{name}",
    }
