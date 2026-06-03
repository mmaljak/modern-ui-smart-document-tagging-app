from __future__ import annotations

import asyncio
import time

import structlog
from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    Header,
    HTTPException,
    Request,
    UploadFile,
    status,
)
from slowapi import Limiter
from slowapi.util import get_remote_address

from document_tagger import __version__

from ...core.config import Settings, get_settings
from ...core.metrics import CLASSIFY_DURATION, PREDICTIONS_TOTAL, TOP_CONFIDENCE
from ...services.embedding_classifier import OpenAIError, create_embedding_classifier
from ...services.extractor import ExtractionError, extract_text
from ...services.local_embedding_classifier import create_local_embedding_classifier
from ...services.registry import DEFAULT_BACKEND, get_backend
from ...utils.validators import validate_upload
from .schemas import HealthResponse, TagResponse, TagResult, TaxonomyCategory

logger = structlog.get_logger(__name__)
limiter = Limiter(key_func=get_remote_address)
router = APIRouter()


@router.get("/health", response_model=HealthResponse, tags=["ops"])
async def health_check(request: Request) -> HealthResponse:
    # model_loaded reflects whether the default model finished warming at startup.
    # (Other backends load lazily on first use.) Tests inject app.state.classifier
    # without model_ready, so fall back to that classifier's own loaded state.
    state = request.app.state
    ready = getattr(state, "model_ready", None)
    if ready is None:
        classifier = getattr(state, "classifier", None)
        ready = classifier.is_loaded if classifier else False
    return HealthResponse(
        status="ok",
        model_loaded=bool(ready),
        version=__version__,
    )


@router.post("/tag", response_model=TagResponse, tags=["tagging"])
@limiter.limit(lambda: get_settings().rate_limit_tag_endpoint)
async def tag_document(
    request: Request,
    file: UploadFile = File(..., description="PDF, DOCX, or plain-text document"),
    include_text: bool = False,
    model: str = Form(DEFAULT_BACKEND, description="Classification backend id (see registry)"),
    # User-supplied OpenAI key for the paid embedding backends. Transits transiently —
    # never logged, never persisted.
    x_openai_key: str | None = Header(default=None, alias="X-OpenAI-Key"),
    settings: Settings = Depends(get_settings),
) -> TagResponse:
    logger.info(
        "tag_request_received",
        filename=file.filename,
        content_type=file.content_type,
        model=model,
    )

    backend = get_backend(model)
    if backend is None:
        raise HTTPException(status_code=422, detail=f"Unknown model: {model!r}")

    # OpenAI backends need a user-supplied key; local backends never do. Local models
    # load lazily on first use (handled at dispatch), so there's no readiness gate here.
    if backend.provider == "openai" and not (x_openai_key and x_openai_key.strip()):
        raise HTTPException(
            status_code=422,
            detail=f"'{backend.label}' requires an OpenAI API key "
            "(send it in the X-OpenAI-Key header).",
        )

    content = await validate_upload(file, settings)

    # Re-detect MIME from full bytes for the extractor dispatch
    from ...utils.validators import _detect_mime

    mime = _detect_mime(content[:2048], file.filename or "")

    try:
        text = extract_text(content, mime)
    except ExtractionError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    if not text.strip():
        raise HTTPException(
            status_code=422,
            detail="Document appears to be empty after text extraction.",
        )

    # ── Dispatch to the chosen backend ──────────────────────────────────────────
    start = time.perf_counter()
    if backend.provider == "local":
        classifier = getattr(request.app.state, "classifier", None)
        if classifier is None:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Local classifier unavailable.",
            )
        if not classifier.is_loaded:
            # Lazy first-use load (BART is ~1.6 GB and not warmed at startup).
            await asyncio.to_thread(classifier.load)
        result = await classifier.classify(text)
        model_version = settings.hf_model_name
    elif backend.provider == "local-embedding":
        local_clf = create_local_embedding_classifier(settings, backend.hf_embedding_model)
        result = await local_clf.classify(text)
        model_version = backend.hf_embedding_model
    else:  # openai
        embed_clf = create_embedding_classifier(
            settings, api_key=x_openai_key, openai_model=backend.openai_model
        )
        try:
            result = await embed_clf.classify(text)
        except OpenAIError as exc:
            raise HTTPException(status_code=502, detail=f"OpenAI request failed: {exc}")
        model_version = backend.openai_model
    CLASSIFY_DURATION.labels(backend.id).observe(time.perf_counter() - start)

    tags = [
        TagResult(category=TaxonomyCategory(t["category"]), confidence=t["confidence"])
        for t in result.tags
    ]

    # ── Model metrics (low-cardinality labels only: backend + taxonomy category) ──
    if tags:
        TOP_CONFIDENCE.labels(backend.id).observe(tags[0].confidence)
        PREDICTIONS_TOTAL.labels(backend.id, tags[0].category.value).inc()

    logger.info(
        "tag_request_complete",
        filename=file.filename,
        backend=backend.id,
        tags=[t.category for t in tags],
    )

    return TagResponse(
        tags=tags,
        key_sentences=result.key_sentences,
        extraction_char_count=len(text),
        extracted_text=text if include_text else None,
        model_version=model_version,
        backend=backend.id,
    )
