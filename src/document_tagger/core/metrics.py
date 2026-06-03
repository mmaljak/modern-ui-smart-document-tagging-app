"""Prometheus metrics for observability.

All metric objects and the Instrumentator live at MODULE scope and are created
exactly once at import time. They must NOT be created inside create_app():
the test suite builds the app per-test (tests/conftest.py), and re-creating a
Counter/Histogram with the same name raises "Duplicated timeseries in
CollectorRegistry".

Two layers of metrics:
  - HTTP RED (Rate/Errors/Duration) — emitted automatically by the
    Instrumentator for every request.
  - Custom model metrics — recorded in the classify path (api/v1/router.py),
    labeled only by low-cardinality keys (backend, taxonomy category). Never
    label by filename or any document-derived value (unbounded cardinality).
"""

from __future__ import annotations

from prometheus_client import Counter, Histogram
from prometheus_fastapi_instrumentator import Instrumentator

# Auto HTTP metrics + /metrics endpoint. Exclude the metrics and health
# handlers so they don't pollute the latency histograms.
instrumentator = Instrumentator(
    excluded_handlers=["/metrics", "/api/v1/health"],
)

# ── Custom model metrics ────────────────────────────────────────────────────

PREDICTIONS_TOTAL = Counter(
    "document_tag_predictions_total",
    "Number of tagging predictions, by backend and top predicted category.",
    ["backend", "category"],
)

CLASSIFY_DURATION = Histogram(
    "document_tag_classify_duration_seconds",
    "Time spent in the classifier backend per /tag request.",
    ["backend"],
)

TOP_CONFIDENCE = Histogram(
    "document_tag_top_confidence",
    "Confidence score of the top predicted tag (0-1).",
    ["backend"],
    buckets=(0.1, 0.3, 0.5, 0.7, 0.9, 0.95, 0.99, 1.0),
)
