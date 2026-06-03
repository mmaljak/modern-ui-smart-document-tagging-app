from __future__ import annotations

import io

import pdfplumber
import structlog
from docx import Document

logger = structlog.get_logger(__name__)


class ExtractionError(RuntimeError):
    pass


def extract_text(content: bytes, mime_type: str) -> str:
    dispatch = {
        "application/pdf": _extract_pdf,
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document": _extract_docx,
        "text/plain": _extract_txt,
    }
    handler = dispatch.get(mime_type)
    if handler is None:
        raise ExtractionError(f"No extractor for MIME type: {mime_type}")
    return handler(content)


def _extract_pdf(content: bytes) -> str:
    try:
        with pdfplumber.open(io.BytesIO(content)) as pdf:
            pages = [p.extract_text() or "" for p in pdf.pages]
        text = "\n".join(pages).strip()
        logger.info("pdf_extracted", char_count=len(text), page_count=len(pages))
        return text
    except Exception as exc:
        raise ExtractionError(f"PDF extraction failed: {exc}") from exc


def _extract_docx(content: bytes) -> str:
    try:
        doc = Document(io.BytesIO(content))
        paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
        text = "\n".join(paragraphs)
        logger.info("docx_extracted", char_count=len(text), paragraph_count=len(paragraphs))
        return text
    except Exception as exc:
        raise ExtractionError(f"DOCX extraction failed: {exc}") from exc


def _extract_txt(content: bytes) -> str:
    text = content.decode("utf-8", errors="replace").strip()
    logger.info("txt_extracted", char_count=len(text))
    return text
