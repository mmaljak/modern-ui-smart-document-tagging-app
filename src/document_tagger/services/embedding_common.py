"""Shared embedding-classification pipeline.

Both the OpenAI (:mod:`.embedding_classifier`) and the local BGE
(:mod:`.local_embedding_classifier`) backends classify the same way — embed the
document and each taxonomy *prototype description*, rank labels by cosine
similarity, softmax the similarities into a 0–1 distribution, then pick key
sentences by similarity to the winning label. Only the embedding step differs
(remote API vs local model), so it is injected as `embed_fn`.

`embed_fn(texts) -> np.ndarray` must return one **unit-normalized** row vector per
input (so cosine similarity is a plain dot product).
"""

from __future__ import annotations

import re
from typing import Callable

import numpy as np

from .classifier import ClassificationResult

EmbedFn = Callable[[list[str]], np.ndarray]

# Prototype-embedding cache, keyed by a per-model identifier (OpenAI model name or
# HF model name — these never collide). The taxonomy is fixed, so prototypes are
# embedded once per model and reused across requests.
_label_cache: dict[str, tuple[list[str], np.ndarray]] = {}


def softmax(sims: np.ndarray, temperature: float) -> np.ndarray:
    z = sims / temperature
    z = z - z.max()  # numerical stability
    e = np.exp(z)
    return e / e.sum()


def threshold_tags(
    labels: list[str], scores: np.ndarray, threshold: float, min_tags: int
) -> list[dict]:
    pairs = sorted(zip(labels, scores), key=lambda x: x[1], reverse=True)
    above = [
        {"category": lbl, "confidence": round(float(s), 4)}
        for lbl, s in pairs
        if s >= threshold
    ]
    if len(above) < min_tags:
        above = [
            {"category": lbl, "confidence": round(float(s), 4)}
            for lbl, s in pairs[:min_tags]
        ]
    return above


def _label_embeddings(
    cache_key: str, labels: list[str], prototypes: list[str], embed_fn: EmbedFn
) -> tuple[list[str], np.ndarray]:
    cached = _label_cache.get(cache_key)
    if cached is not None:
        return cached
    mat = embed_fn(prototypes)
    _label_cache[cache_key] = (labels, mat)
    return labels, mat


def _key_sentences(
    text: str,
    label_vec: np.ndarray,
    embed_fn: EmbedFn,
    max_sentences_to_score: int,
    max_key_sentences: int,
) -> list[str]:
    sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+", text) if s.strip()]
    candidates = sentences[:max_sentences_to_score]
    if not candidates:
        return []
    sent_mat = embed_fn(candidates)
    sims = sent_mat @ label_vec
    order = np.argsort(sims)[::-1][:max_key_sentences]
    return [candidates[i] for i in order]


def classify_by_embedding(
    *,
    full_text: str,
    truncated: str,
    labels: list[str],
    prototypes: list[str],
    embed_fn: EmbedFn,
    cache_key: str,
    temperature: float,
    threshold: float,
    min_tags: int,
    max_sentences_to_score: int,
    max_key_sentences: int,
) -> ClassificationResult:
    labels, label_mat = _label_embeddings(cache_key, labels, prototypes, embed_fn)
    doc_vec = embed_fn([truncated])[0]
    sims = label_mat @ doc_vec  # cosine — operands are unit-normalized
    scores = softmax(sims, temperature)
    tags = threshold_tags(labels, scores, threshold, min_tags)

    winning = tags[0]["category"]
    win_vec = label_mat[labels.index(winning)]
    key_sentences = _key_sentences(
        full_text, win_vec, embed_fn, max_sentences_to_score, max_key_sentences
    )
    return ClassificationResult(tags=tags, key_sentences=key_sentences)
