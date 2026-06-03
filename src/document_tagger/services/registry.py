"""Classification backend registry.

A single source of truth for which models the API accepts on the `/tag` `model`
field, what provider each maps to, and whether a user-supplied key is required.
The frontend keeps a parallel registry for its picker UI.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class BackendSpec:
    id: str  # value sent on the /tag `model` field
    provider: str  # "local" | "local-embedding" | "openai"
    label: str  # human-readable name echoed back in the response
    requires_key: bool
    openai_model: str | None = None  # concrete model name for the openai provider
    hf_embedding_model: str | None = None  # HF model name for the local-embedding provider


BACKENDS: dict[str, BackendSpec] = {
    "bge-small": BackendSpec(
        id="bge-small",
        provider="local-embedding",
        label="BGE-small (local embeddings)",
        requires_key=False,
        hf_embedding_model="BAAI/bge-small-en-v1.5",
    ),
    "local": BackendSpec(
        id="local",
        provider="local",
        label="Local model (BART zero-shot)",
        requires_key=False,
    ),
    "openai-3-small": BackendSpec(
        id="openai-3-small",
        provider="openai",
        label="text-embedding-3-small",
        requires_key=True,
        openai_model="text-embedding-3-small",
    ),
    "openai-3-large": BackendSpec(
        id="openai-3-large",
        provider="openai",
        label="text-embedding-3-large",
        requires_key=True,
        openai_model="text-embedding-3-large",
    ),
}

DEFAULT_BACKEND = "bge-small"


def get_backend(model_id: str | None) -> BackendSpec | None:
    return BACKENDS.get(model_id or DEFAULT_BACKEND)
