"""Local embedding-based classification backend (e.g. BAAI/bge-small-en-v1.5).

Free, fully local alternative to the OpenAI embedding backend — nothing leaves the
machine, no API key. Shares the embedding pipeline in :mod:`.embedding_common` and
supplies embeddings from a locally-loaded sentence-transformers model.

The model is loaded lazily and cached process-wide (keyed by name) behind a lock, so
the first request that needs it pays the load cost once and all later requests reuse it.
"""

from __future__ import annotations

import asyncio
import threading

import numpy as np
import structlog

from ..core.config import Settings
from . import embedding_common
from .classifier import ClassificationResult

logger = structlog.get_logger(__name__)

_model_cache: dict[str, object] = {}
_load_lock = threading.Lock()


def _get_model(model_name: str):
    model = _model_cache.get(model_name)
    if model is not None:
        return model
    with _load_lock:  # double-checked: only one thread loads a given model
        model = _model_cache.get(model_name)
        if model is None:
            from sentence_transformers import SentenceTransformer  # deferred heavy import

            logger.info("local_embedding_model_loading_start", model=model_name)
            model = SentenceTransformer(model_name)
            _model_cache[model_name] = model
            logger.info("local_embedding_model_loading_complete", model=model_name)
    return model


class LocalEmbeddingClassifier:
    def __init__(self, settings: Settings, model_name: str) -> None:
        self._settings = settings
        self._model_name = model_name

    @property
    def is_loaded(self) -> bool:
        return self._model_name in _model_cache

    def load(self) -> None:
        _get_model(self._model_name)

    async def classify(self, text: str) -> ClassificationResult:
        truncated = text[: self._settings.local_embedding_max_classify_chars]
        logger.info(
            "local_embedding_classification_start",
            model=self._model_name,
            char_count=len(truncated),
        )
        return await asyncio.to_thread(self._classify_sync, text, truncated)

    # ── internal helpers ──────────────────────────────────────────────────────

    def _embed(self, inputs: list[str]) -> np.ndarray:
        model = _get_model(self._model_name)
        vecs = model.encode(inputs, normalize_embeddings=True, convert_to_numpy=True)
        return np.asarray(vecs, dtype=np.float32)

    def _classify_sync(self, full_text: str, truncated: str) -> ClassificationResult:
        s = self._settings
        result = embedding_common.classify_by_embedding(
            full_text=full_text,
            truncated=truncated,
            labels=s.taxonomy_labels,
            prototypes=[s.taxonomy_descriptions.get(lbl, lbl) for lbl in s.taxonomy_labels],
            embed_fn=self._embed,
            cache_key=self._model_name,
            temperature=s.local_embedding_softmax_temperature,
            threshold=s.local_embedding_tag_threshold,
            min_tags=s.always_return_min_tags,
            max_sentences_to_score=s.max_sentences_to_score,
            max_key_sentences=s.max_key_sentences,
        )
        logger.info(
            "local_embedding_classification_complete",
            model=self._model_name,
            tag_count=len(result.tags),
            top_tag=result.tags[0]["category"],
            top_confidence=result.tags[0]["confidence"],
        )
        return result


def create_local_embedding_classifier(
    settings: Settings, model_name: str
) -> LocalEmbeddingClassifier:
    return LocalEmbeddingClassifier(settings, model_name)
