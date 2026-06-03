# ── Stage 1: builder ──────────────────────────────────────────────────────────
# Pinned by digest for reproducible builds (tag kept for readability).
FROM python:3.11-slim@sha256:a3ab0b966bc4e91546a033e22093cb840908979487a9fc0e6e38295747e49ac0 AS builder

RUN pip install --no-cache-dir uv

WORKDIR /app
# README.md is required because pyproject sets `readme = "README.md"` (Hatchling
# validates it when building the wheel).
COPY pyproject.toml README.md ./

# Production deps only (no dev/test tooling in the runtime image).
# CPU-only torch from PyTorch's wheel index (avoids pulling the CUDA variant).
RUN uv pip install --system --no-cache \
    --extra-index-url https://download.pytorch.org/whl/cpu \
    "."

# ── Stage 2: runtime ──────────────────────────────────────────────────────────
FROM python:3.11-slim@sha256:a3ab0b966bc4e91546a033e22093cb840908979487a9fc0e6e38295747e49ac0 AS runtime

# libmagic1 for python-magic; curl for the health-check
RUN apt-get update \
    && apt-get install -y --no-install-recommends libmagic1 curl \
    && rm -rf /var/lib/apt/lists/*

# Run as an unprivileged user. HF_HOME lives under the user's home so the
# model cache is writable without root. Pre-create and chown the cache dir so
# that when the hf_cache named volume mounts here, Docker initializes it with
# app's ownership (otherwise the volume defaults to root and the download fails).
RUN useradd --create-home --uid 1000 app \
    && mkdir -p /home/app/.cache/huggingface \
    && chown -R app:app /home/app/.cache

WORKDIR /app

COPY --from=builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

COPY src/ ./src/

ENV PYTHONPATH=/app/src \
    HF_HOME=/home/app/.cache/huggingface \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

USER app

EXPOSE 8000

HEALTHCHECK --interval=15s --timeout=5s --start-period=90s --retries=5 \
    CMD curl -fsS http://localhost:8000/api/v1/health || exit 1

CMD ["uvicorn", "document_tagger.main:app", "--host", "0.0.0.0", "--port", "8000"]
