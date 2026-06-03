from __future__ import annotations

import asyncio
import uuid
from contextlib import asynccontextmanager
from typing import AsyncIterator

import structlog
import structlog.contextvars
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from .api.v1.router import limiter
from .api.v1.router import router as v1_router
from .core.config import get_settings
from .core.logging import configure_logging
from .core.metrics import instrumentator
from .services.classifier import create_classifier
from .services.local_embedding_classifier import create_local_embedding_classifier
from .services.registry import DEFAULT_BACKEND, get_backend

logger = structlog.get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    settings = get_settings()
    configure_logging(debug=settings.debug)

    app.state.settings = settings
    app.state.model_ready = False

    # The BART classifier object is always available for the lazy "local" path, but is
    # NOT loaded here — it's 1.6 GB and no longer the default. Tests inject a mock.
    if not hasattr(app.state, "classifier"):
        app.state.classifier = create_classifier(settings)

    # Warm only the default backend's model so the first request is fast while keeping
    # first boot lean (default is the ~130 MB BGE embeddings model). Heavier non-default
    # models (e.g. BART) download lazily on first use.
    default = get_backend(DEFAULT_BACKEND)
    if default and default.provider == "local-embedding":
        await asyncio.to_thread(
            create_local_embedding_classifier(settings, default.hf_embedding_model).load
        )
    elif default and default.provider == "local":
        await asyncio.to_thread(app.state.classifier.load)
    app.state.model_ready = True

    logger.info("startup", default_backend=DEFAULT_BACKEND, debug=settings.debug)
    yield
    logger.info("shutdown")


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title=settings.api_title,
        version=settings.api_version,
        lifespan=lifespan,
    )

    # ── Middleware ────────────────────────────────────────────────────────────
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_methods=["GET", "POST"],
        allow_headers=["*"],
    )
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
    app.add_middleware(SlowAPIMiddleware)

    # Request-ID middleware: binds a UUID to every log line within a request
    @app.middleware("http")
    async def _request_id_middleware(request: Request, call_next):
        structlog.contextvars.clear_contextvars()
        structlog.contextvars.bind_contextvars(request_id=str(uuid.uuid4()))
        return await call_next(request)

    # ── Observability ─────────────────────────────────────────────────────────
    # Auto HTTP RED metrics + a Prometheus scrape endpoint at /metrics.
    # The instrumentator and custom metrics are module-level singletons.
    instrumentator.instrument(app).expose(app, endpoint="/metrics")

    # ── Routes ────────────────────────────────────────────────────────────────
    app.include_router(v1_router, prefix="/api/v1")

    return app


app = create_app()
