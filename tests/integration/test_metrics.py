from __future__ import annotations

import pytest
from prometheus_client import REGISTRY


@pytest.mark.asyncio
async def test_metrics_endpoint_exposes_all_families(async_client):
    resp = await async_client.get("/metrics")
    assert resp.status_code == 200
    body = resp.text
    # Auto HTTP RED metrics from the instrumentator...
    assert "http_request" in body
    # ...plus the custom model metrics.
    for name in (
        "document_tag_predictions_total",
        "document_tag_classify_duration_seconds",
        "document_tag_top_confidence",
    ):
        assert name in body, f"missing metric: {name}"


@pytest.mark.asyncio
async def test_tag_request_increments_prediction_counter(async_client, sample_txt_bytes):
    """A real /tag call must move the model metrics — proves the classify-path
    instrumentation fired, not just that the endpoint exists. The registry is
    process-global, so assert the delta rather than an absolute value."""
    labels = {"backend": "local", "category": "Invoice"}  # mock classifier returns Invoice

    def counter_value() -> float:
        # The counter name already ends in _total, so prometheus_client does not
        # append another suffix — the sample name is the metric name as-is.
        return REGISTRY.get_sample_value("document_tag_predictions_total", labels) or 0.0

    before = counter_value()

    resp = await async_client.post(
        "/api/v1/tag",
        files={"file": ("invoice.txt", sample_txt_bytes, "text/plain")},
        data={"model": "local"},  # exercise the injected BART mock (default is now BGE)
    )
    assert resp.status_code == 200

    assert counter_value() == before + 1.0

    # The histograms should also have recorded an observation for this backend.
    conf_count = REGISTRY.get_sample_value(
        "document_tag_top_confidence_count", {"backend": "local"}
    )
    assert conf_count is not None and conf_count >= 1.0
