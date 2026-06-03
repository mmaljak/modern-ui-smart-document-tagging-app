"""OpenAI embedding-based classification backend.

A paid, cloud alternative to the local backends. It shares the embedding pipeline in
:mod:`.embedding_common` (embed document + taxonomy prototypes, rank by cosine, softmax,
key sentences) and only supplies the embedding step via the OpenAI API.

The per-request API key transits this process transiently: it is never logged and
never persisted.
"""

from __future__ import annotations

import asyncio

import numpy as np
import structlog

from ..core.config import Settings
from . import embedding_common
from .classifier import ClassificationResult

logger = structlog.get_logger(__name__)


class OpenAIError(Exception):
    """An OpenAI API call failed (bad key, rate limit, network). Surfaced as HTTP 4xx."""


class OpenAIEmbeddingClassifier:
    def __init__(self, settings: Settings, api_key: str, openai_model: str) -> None:
        self._settings = settings
        self._api_key = api_key
        self._model = openai_model

    async def classify(self, text: str) -> ClassificationResult:
        truncated = text[: self._settings.openai_max_classify_chars]
        logger.info("openai_classification_start", model=self._model, char_count=len(truncated))
        return await asyncio.to_thread(self._classify_sync, text, truncated)

    # ── internal helpers ──────────────────────────────────────────────────────

    def _client(self):
        from openai import OpenAI  # deferred import — keeps the local path lean

        return OpenAI(api_key=self._api_key)

    def _embed(self, inputs: list[str]) -> np.ndarray:
        resp = self._client_obj.embeddings.create(model=self._model, input=inputs)
        vecs = np.array([d.embedding for d in resp.data], dtype=np.float32)
        norms = np.linalg.norm(vecs, axis=1, keepdims=True)
        norms[norms == 0] = 1.0
        return vecs / norms  # unit-normalize (defensive — OpenAI already returns normed)

    def _classify_sync(self, full_text: str, truncated: str) -> ClassificationResult:
        s = self._settings
        try:
            self._client_obj = self._client()
            result = embedding_common.classify_by_embedding(
                full_text=full_text,
                truncated=truncated,
                labels=s.taxonomy_labels,
                prototypes=[s.taxonomy_descriptions.get(lbl, lbl) for lbl in s.taxonomy_labels],
                embed_fn=self._embed,
                cache_key=self._model,
                temperature=s.openai_softmax_temperature,
                threshold=s.openai_tag_threshold,
                min_tags=s.always_return_min_tags,
                max_sentences_to_score=s.max_sentences_to_score,
                max_key_sentences=s.max_key_sentences,
            )
        except Exception as exc:  # bad key / rate limit / network
            raise OpenAIError(str(exc)) from exc

        logger.info(
            "openai_classification_complete",
            model=self._model,
            tag_count=len(result.tags),
            top_tag=result.tags[0]["category"],
            top_confidence=result.tags[0]["confidence"],
        )
        return result


def create_embedding_classifier(
    settings: Settings, api_key: str, openai_model: str
) -> OpenAIEmbeddingClassifier:
    return OpenAIEmbeddingClassifier(settings, api_key, openai_model)
