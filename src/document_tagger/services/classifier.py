from __future__ import annotations

import asyncio
from dataclasses import dataclass

import structlog

from ..core.config import Settings

logger = structlog.get_logger(__name__)


@dataclass
class ClassificationResult:
    tags: list[dict]  # [{"category": str, "confidence": float}]
    key_sentences: list[str]


class DocumentClassifier:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._pipeline = None
        self._loaded = False

    @property
    def is_loaded(self) -> bool:
        return self._loaded

    def load(self) -> None:
        from transformers import pipeline  # deferred — heavy import

        logger.info("model_loading_start", model=self._settings.hf_model_name)
        self._pipeline = pipeline(
            "zero-shot-classification",
            model=self._settings.hf_model_name,
            device=-1,  # CPU; set to 0 for first GPU
        )
        self._loaded = True
        logger.info("model_loading_complete", model=self._settings.hf_model_name)

    async def classify(self, text: str) -> ClassificationResult:
        if not self._loaded or self._pipeline is None:
            raise RuntimeError("Classifier not loaded — call load() first")

        truncated = text[: self._settings.max_classify_chars]
        logger.info("classification_start", char_count=len(truncated))

        raw = await asyncio.to_thread(self._run_pipeline, truncated)
        tags = self._threshold_tags(raw)

        winning_label = tags[0]["category"]
        key_sentences = await asyncio.to_thread(
            self._extract_key_sentences, text, winning_label
        )

        logger.info(
            "classification_complete",
            tag_count=len(tags),
            top_tag=winning_label,
            top_confidence=tags[0]["confidence"],
        )
        return ClassificationResult(tags=tags, key_sentences=key_sentences)

    # ── internal helpers ──────────────────────────────────────────────────────

    def _run_pipeline(self, text: str) -> dict:
        return self._pipeline(
            text,
            candidate_labels=self._settings.taxonomy_labels,
            hypothesis_template="This document is a {}.",
            multi_label=True,
        )

    def _threshold_tags(self, raw: dict) -> list[dict]:
        pairs = sorted(
            zip(raw["labels"], raw["scores"]), key=lambda x: x[1], reverse=True
        )
        above = [
            {"category": lbl, "confidence": round(score, 4)}
            for lbl, score in pairs
            if score >= self._settings.tag_confidence_threshold
        ]
        # Always return at least min_tags to avoid empty responses
        if len(above) < self._settings.always_return_min_tags:
            above = [
                {"category": lbl, "confidence": round(score, 4)}
                for lbl, score in pairs[: self._settings.always_return_min_tags]
            ]
        return above

    def _extract_key_sentences(self, text: str, winning_label: str) -> list[str]:
        import re

        sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+", text) if s.strip()]
        candidates = sentences[: self._settings.max_sentences_to_score]
        if not candidates:
            return []

        results = self._pipeline(
            candidates,
            candidate_labels=[winning_label],
            hypothesis_template="This sentence is relevant to a {}.",
            multi_label=False,
        )
        # results is a list of dicts when input is a list
        if isinstance(results, dict):
            results = [results]

        scored = sorted(
            zip(candidates, [r["scores"][0] for r in results]),
            key=lambda x: x[1],
            reverse=True,
        )
        return [s for s, _ in scored[: self._settings.max_key_sentences]]


def create_classifier(settings: Settings) -> DocumentClassifier:
    return DocumentClassifier(settings)
