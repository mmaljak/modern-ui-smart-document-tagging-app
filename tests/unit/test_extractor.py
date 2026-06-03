from __future__ import annotations

import io

import pytest
from docx import Document

from document_tagger.services.extractor import ExtractionError, extract_text

_DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"


def test_txt_utf8():
    text = extract_text(b"Hello World", "text/plain")
    assert text == "Hello World"


def test_txt_latin1_fallback():
    latin1_bytes = "Résumé".encode("latin-1")
    text = extract_text(latin1_bytes, "text/plain")
    assert text  # replacement chars are fine — no crash


def test_docx_extraction():
    doc = Document()
    doc.add_paragraph("Invoice for consulting services.")
    buf = io.BytesIO()
    doc.save(buf)
    text = extract_text(buf.getvalue(), _DOCX_MIME)
    assert "Invoice" in text


def test_docx_corrupted_raises():
    with pytest.raises(ExtractionError, match="DOCX"):
        extract_text(b"not a docx", _DOCX_MIME)


def test_unknown_mime_raises():
    with pytest.raises(ExtractionError, match="MIME"):
        extract_text(b"data", "image/jpeg")


def test_txt_empty_returns_empty():
    text = extract_text(b"   \n  ", "text/plain")
    assert text == ""
