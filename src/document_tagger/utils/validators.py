from __future__ import annotations

from pathlib import Path

import structlog
from fastapi import HTTPException, UploadFile, status

from ..core.config import Settings

logger = structlog.get_logger(__name__)

# Attempt to import libmagic; fall back to extension-based detection on Windows
# where libmagic may not be installed (python-magic-bin covers the DLL, but
# some environments still fail). The fallback is good enough for dev/CI.
try:
    import magic as _magic

    _HAS_MAGIC = True
except (ImportError, OSError):
    _HAS_MAGIC = False
    logger.warning("python-magic unavailable; falling back to extension-based MIME detection")

_EXT_TO_MIME: dict[str, str] = {
    ".pdf": "application/pdf",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".txt": "text/plain",
}

# DOCX files are ZIP archives; magic sometimes reports these MIME types for them
_DOCX_ZIP_ALIASES = frozenset(
    ["application/zip", "application/x-zip-compressed", "application/x-zip"]
)


def _detect_mime(header: bytes, filename: str) -> str:
    ext = Path(filename).suffix.lower()
    if _HAS_MAGIC:
        detected: str = _magic.from_buffer(header, mime=True)
        if detected in _DOCX_ZIP_ALIASES and ext == ".docx":
            return "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        return detected
    return _EXT_TO_MIME.get(ext, "application/octet-stream")


async def validate_upload(file: UploadFile, settings: Settings) -> bytes:
    header = await file.read(2048)
    mime = _detect_mime(header, file.filename or "")

    if mime not in settings.allowed_mime_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file type '{mime}'. Accepted: PDF, DOCX, plain text.",
        )

    remainder = await file.read()
    content = header + remainder

    if len(content) > settings.max_file_size_bytes:
        limit_mb = settings.max_file_size_bytes // 1_048_576
        raise HTTPException(
            status_code=413,
            detail=f"File exceeds {limit_mb} MB limit.",
        )

    return content
