"""Offline test for the local BGE embedding backend.

The real sentence-transformers model is never loaded — `_get_model` is monkeypatched
to a fake that returns deterministic unit vectors — so CI stays network-free.
"""

from __future__ import annotations

import hashlib

import numpy as np
import pytest

import document_tagger.services.embedding_common as embedding_common
import document_tagger.services.local_embedding_classifier as lec
from document_tagger.core.config import get_settings


class _FakeEmbedModel:
    """Stand-in for SentenceTransformer: maps each text to a stable unit vector."""

    def encode(self, inputs, normalize_embeddings=True, convert_to_numpy=True):
        out = []
        for t in inputs:
            seed = int(hashlib.sha256(t.encode()).hexdigest()[:8], 16)
            v = np.random.default_rng(seed).standard_normal(16).astype(np.float32)
            out.append(v / np.linalg.norm(v))
        return np.array(out, dtype=np.float32)


@pytest.fixture(autouse=True)
def _no_model_download(monkeypatch):
    monkeypatch.setattr(lec, "_get_model", lambda name: _FakeEmbedModel())
    embedding_common._label_cache.clear()  # re-embed prototypes with the fake model
    yield
    embedding_common._label_cache.clear()


@pytest.mark.asyncio
async def test_bge_backend_returns_tags(async_client, sample_txt_bytes):
    resp = await async_client.post(
        "/api/v1/tag",
        files={"file": ("invoice.txt", sample_txt_bytes, "text/plain")},
        data={"model": "bge-small"},
    )
    assert resp.status_code == 200
    body = resp.json()

    assert body["backend"] == "bge-small"
    assert body["model_version"] == "BAAI/bge-small-en-v1.5"
    assert len(body["tags"]) >= 1

    tag = body["tags"][0]
    assert 0.0 <= tag["confidence"] <= 1.0
    assert tag["category"] in get_settings().taxonomy_labels


@pytest.mark.asyncio
async def test_bge_backend_needs_no_key(async_client, sample_txt_bytes):
    # No X-OpenAI-Key header — local backends must never require one.
    resp = await async_client.post(
        "/api/v1/tag",
        files={"file": ("invoice.txt", sample_txt_bytes, "text/plain")},
        data={"model": "bge-small"},
    )
    assert resp.status_code == 200
