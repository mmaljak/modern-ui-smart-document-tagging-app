from __future__ import annotations

from enum import Enum

from pydantic import BaseModel, Field


class TaxonomyCategory(str, Enum):
    invoice = "Invoice"
    contract = "Contract"
    specification = "Specification"
    report = "Report"
    memo = "Memo"
    proposal = "Proposal"
    nda = "Non-Disclosure Agreement"
    policy = "Policy"


class TagResult(BaseModel):
    category: TaxonomyCategory
    confidence: float = Field(ge=0.0, le=1.0)


class TagResponse(BaseModel):
    tags: list[TagResult]
    key_sentences: list[str]
    extraction_char_count: int
    extracted_text: str | None = None
    model_version: str
    backend: str  # registry id of the backend that produced this result


class HealthResponse(BaseModel):
    status: str
    model_loaded: bool
    version: str
