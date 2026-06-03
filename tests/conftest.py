from __future__ import annotations

import io
from unittest.mock import AsyncMock, MagicMock

import pytest
from docx import Document
from httpx import ASGITransport, AsyncClient

from document_tagger.main import create_app
from document_tagger.services.classifier import ClassificationResult


@pytest.fixture(autouse=True)
def reset_rate_limiter():
    """Clear the in-memory rate limit counters between every test."""
    from document_tagger.api.v1.router import limiter

    storage = getattr(limiter, "_storage", None)
    if storage is not None:
        for attr in ("_storage", "_events", "storage"):
            data = getattr(storage, attr, None)
            if isinstance(data, dict):
                data.clear()
    yield


@pytest.fixture
def mock_classifier():
    clf = MagicMock()
    clf.is_loaded = True
    clf.classify = AsyncMock(
        return_value=ClassificationResult(
            tags=[
                {"category": "Invoice", "confidence": 0.92},
                {"category": "Contract", "confidence": 0.12},
            ],
            key_sentences=["Payment is due within 30 days."],
        )
    )
    return clf


@pytest.fixture
async def async_client(mock_classifier):
    app = create_app()
    app.state.classifier = mock_classifier  # injected before lifespan runs
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        yield client


@pytest.fixture
def sample_txt_bytes() -> bytes:
    return (
        b"INVOICE #INV-2024-001\n"
        b"Bill To: Acme Corp\n"
        b"Consulting Services: 40hrs @ $150/hr = $6,000\n"
        b"Tax (8%): $480\n"
        b"Amount Due: $6,480\n"
        b"Payment Terms: Net 30\n"
    )


@pytest.fixture
def sample_pdf_bytes() -> bytes:
    # Minimal valid PDF with one page containing "Invoice" text
    return (
        b"%PDF-1.4\n"
        b"1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n"
        b"2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n"
        b"3 0 obj<</Type/Page/Parent 2 0 R/Resources<</Font<</F1 4 0 R>>>>"
        b"/MediaBox[0 0 612 792]/Contents 5 0 R>>endobj\n"
        b"4 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\n"
        b"5 0 obj<</Length 44>>\nstream\n"
        b"BT /F1 12 Tf 100 700 Td (Invoice) Tj ET\nendstream\nendobj\n"
        b"xref\n0 6\n0000000000 65535 f\n"
        b"trailer<</Size 6/Root 1 0 R>>\nstartxref\n0\n%%EOF\n"
    )


@pytest.fixture
def sample_docx_bytes() -> bytes:
    doc = Document()
    doc.add_paragraph("This is a service agreement between two parties.")
    doc.add_paragraph("The parties agree to the following obligations.")
    buf = io.BytesIO()
    doc.save(buf)
    return buf.getvalue()
