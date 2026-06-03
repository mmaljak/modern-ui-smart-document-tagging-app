from __future__ import annotations

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Application
    api_title: str = "Smart Document Tagger"
    api_version: str = "0.1.0"
    debug: bool = False

    # CORS — comma-separated list of browser origins allowed to call the API.
    # Kept as a string (not list[str]) so a plain CORS_ALLOW_ORIGINS env value
    # parses without requiring JSON; split via the cors_origins property.
    cors_allow_origins: str = "http://localhost:3000,http://localhost:5173"

    # Classification — local zero-shot backend (BART)
    hf_model_name: str = "facebook/bart-large-mnli"
    tag_confidence_threshold: float = Field(default=0.97, ge=0.0, le=1.0)
    always_return_min_tags: int = Field(default=1, ge=1)
    max_key_sentences: int = Field(default=3, ge=1)
    max_sentences_to_score: int = Field(default=20, ge=1)
    # Max chars fed to BART (~3 500 ≈ 875 tokens, well under the 1024-token limit
    # after hypothesis overhead; increase to improve recall on long docs)
    max_classify_chars: int = 3500

    # Classification — OpenAI embedding backend (paid, user-supplied key)
    # Cosine similarities between text-embedding-3 vectors cluster ~0.3–0.5 with
    # little spread, so we softmax them with a temperature to separate the
    # distribution into a UI-meaningful 0–1 range. Lower temperature ⇒ sharper.
    openai_softmax_temperature: float = Field(default=0.07, gt=0.0)
    # The BART threshold (0.97) is an artifact of that model and must NOT gate the
    # embedding path — this is the post-softmax cutoff for the OpenAI backend.
    openai_tag_threshold: float = Field(default=0.05, ge=0.0, le=1.0)
    # Embeddings accept far more context than BART's ~1k tokens.
    openai_max_classify_chars: int = 8000

    # Classification — local embedding backend (sentence-transformers, e.g. BGE-small).
    # BGE cosine similarities have a different (wider) distribution than OpenAI's, so this
    # temperature is calibrated independently — do NOT reuse the OpenAI value.
    local_embedding_softmax_temperature: float = Field(default=0.04, gt=0.0)
    local_embedding_tag_threshold: float = Field(default=0.05, ge=0.0, le=1.0)
    # BGE-small caps at ~512 tokens, so keep the document well under that.
    local_embedding_max_classify_chars: int = 2000

    # File validation
    max_file_size_bytes: int = 10_485_760  # 10 MB
    allowed_mime_types: list[str] = [
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "text/plain",
    ]

    # Rate limiting
    rate_limit_tag_endpoint: str = "5/minute"

    # Taxonomy — order matters: enum values are derived from this list
    taxonomy_labels: list[str] = [
        "Invoice",
        "Contract",
        "Specification",
        "Report",
        "Memo",
        "Proposal",
        "Non-Disclosure Agreement",
        "Policy",
    ]

    # Prototype descriptions used by the embedding backend. Embedding a one-line
    # definition classifies far better than the bare label string. Keys must cover
    # every entry in taxonomy_labels; assembled into a prototype with build_prototype().
    taxonomy_descriptions: dict[str, str] = {
        "Invoice": "An invoice: an itemized commercial bill requesting payment, listing "
        "amounts due, line items, quantities, prices, and a total balance.",
        "Contract": "A contract: a legally binding agreement between parties setting out "
        "obligations, terms, conditions, and signatures.",
        "Specification": "A specification: a technical document detailing requirements, "
        "parameters, standards, and design or system characteristics.",
        "Report": "A report: an informational document presenting findings, analysis, "
        "results, metrics, and conclusions on a subject.",
        "Memo": "A memo: a brief internal memorandum communicating a short message, "
        "announcement, or instruction within an organization.",
        "Proposal": "A proposal: a document proposing a project, plan, or offer, outlining "
        "scope, approach, deliverables, timeline, and cost for a client's approval.",
        "Non-Disclosure Agreement": "A non-disclosure agreement (NDA): a confidentiality "
        "contract restricting the disclosure of proprietary or sensitive information.",
        "Policy": "A policy: a formal document stating organizational rules, guidelines, "
        "principles, and procedures that govern conduct or operations.",
    }

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.cors_allow_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
