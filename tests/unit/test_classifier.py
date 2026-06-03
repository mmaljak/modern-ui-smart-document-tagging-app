from __future__ import annotations

from unittest.mock import MagicMock

import pytest

from document_tagger.core.config import Settings
from document_tagger.services.classifier import DocumentClassifier


@pytest.fixture
def settings():
    return Settings(
        taxonomy_labels=["Invoice", "Contract", "Report"],
        tag_confidence_threshold=0.5,
        always_return_min_tags=1,
        max_key_sentences=2,
        max_sentences_to_score=5,
        max_classify_chars=3500,
    )


@pytest.fixture
def loaded_classifier(settings):
    clf = DocumentClassifier(settings)
    mock_pipeline = MagicMock()
    clf._pipeline = mock_pipeline
    clf._loaded = True
    return clf, mock_pipeline


def _make_pipeline_result(labels, scores):
    return {"labels": labels, "scores": scores}


@pytest.mark.asyncio
async def test_threshold_filters_low_scores(loaded_classifier):
    clf, mock_pipeline = loaded_classifier
    mock_pipeline.return_value = _make_pipeline_result(
        ["Invoice", "Contract", "Report"], [0.92, 0.30, 0.10]
    )
    result = await clf.classify("Invoice for services.")
    categories = [t["category"] for t in result.tags]
    assert "Invoice" in categories
    assert "Contract" not in categories  # below 0.5


@pytest.mark.asyncio
async def test_floor_returns_at_least_one_tag(loaded_classifier):
    clf, mock_pipeline = loaded_classifier
    # All below threshold
    mock_pipeline.return_value = _make_pipeline_result(
        ["Invoice", "Contract", "Report"], [0.20, 0.10, 0.05]
    )
    result = await clf.classify("Ambiguous text.")
    assert len(result.tags) >= 1


@pytest.mark.asyncio
async def test_tags_sorted_descending(loaded_classifier):
    clf, mock_pipeline = loaded_classifier
    mock_pipeline.return_value = _make_pipeline_result(
        ["Report", "Invoice", "Contract"], [0.75, 0.91, 0.60]
    )
    result = await clf.classify("Some document text.")
    confidences = [t["confidence"] for t in result.tags]
    assert confidences == sorted(confidences, reverse=True)


@pytest.mark.asyncio
async def test_key_sentences_populated(loaded_classifier):
    clf, mock_pipeline = loaded_classifier
    mock_pipeline.return_value = _make_pipeline_result(
        ["Invoice", "Contract", "Report"], [0.92, 0.10, 0.05]
    )
    result = await clf.classify("Payment due. Amount $500. Net 30 days.")
    assert isinstance(result.key_sentences, list)


@pytest.mark.asyncio
async def test_not_loaded_raises():
    settings = Settings()
    clf = DocumentClassifier(settings)
    with pytest.raises(RuntimeError, match="not loaded"):
        await clf.classify("text")


@pytest.mark.asyncio
async def test_text_truncated_to_max_chars(loaded_classifier, settings):
    clf, mock_pipeline = loaded_classifier
    mock_pipeline.return_value = _make_pipeline_result(
        ["Invoice", "Contract", "Report"], [0.92, 0.10, 0.05]
    )
    long_text = "x" * 10_000
    await clf.classify(long_text)
    # First call arg should be the truncated text
    first_call_text = mock_pipeline.call_args_list[0][0][0]
    assert len(first_call_text) <= settings.max_classify_chars
