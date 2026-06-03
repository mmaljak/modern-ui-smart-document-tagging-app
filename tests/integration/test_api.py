from __future__ import annotations

import pytest


@pytest.mark.asyncio
async def test_health_returns_ok(async_client):
    resp = await async_client.get("/api/v1/health")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    assert body["model_loaded"] is True


@pytest.mark.asyncio
async def test_tag_txt_returns_200(async_client, sample_txt_bytes):
    resp = await async_client.post(
        "/api/v1/tag",
        files={"file": ("invoice.txt", sample_txt_bytes, "text/plain")},
        data={"model": "local"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert "tags" in body
    assert len(body["tags"]) >= 1
    assert "key_sentences" in body


@pytest.mark.asyncio
async def test_tag_response_schema(async_client, sample_txt_bytes):
    resp = await async_client.post(
        "/api/v1/tag",
        files={"file": ("invoice.txt", sample_txt_bytes, "text/plain")},
        data={"model": "local"},
    )
    body = resp.json()
    tag = body["tags"][0]
    assert "category" in tag
    assert "confidence" in tag
    assert 0.0 <= tag["confidence"] <= 1.0
    assert "extraction_char_count" in body
    assert "model_version" in body


@pytest.mark.asyncio
async def test_include_text_query_param(async_client, sample_txt_bytes):
    resp = await async_client.post(
        "/api/v1/tag?include_text=true",
        files={"file": ("invoice.txt", sample_txt_bytes, "text/plain")},
        data={"model": "local"},
    )
    assert resp.status_code == 200
    assert resp.json()["extracted_text"] is not None


@pytest.mark.asyncio
async def test_include_text_false_by_default(async_client, sample_txt_bytes):
    resp = await async_client.post(
        "/api/v1/tag",
        files={"file": ("invoice.txt", sample_txt_bytes, "text/plain")},
        data={"model": "local"},
    )
    assert resp.json()["extracted_text"] is None


@pytest.mark.asyncio
async def test_invalid_mime_returns_400(async_client):
    resp = await async_client.post(
        "/api/v1/tag",
        files={"file": ("photo.jpg", b"\xff\xd8\xff\xe0fake jpeg", "image/jpeg")},
    )
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_missing_file_returns_422(async_client):
    resp = await async_client.post("/api/v1/tag")
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_empty_text_returns_422(async_client):
    resp = await async_client.post(
        "/api/v1/tag",
        files={"file": ("empty.txt", b"   ", "text/plain")},
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_oversized_file_returns_413(async_client):
    big = b"x" * (10 * 1024 * 1024 + 1)
    resp = await async_client.post(
        "/api/v1/tag",
        files={"file": ("big.txt", big, "text/plain")},
    )
    assert resp.status_code == 413


@pytest.mark.asyncio
async def test_rate_limit_returns_429(async_client, sample_txt_bytes):
    for _ in range(5):
        r = await async_client.post(
            "/api/v1/tag",
            files={"file": ("invoice.txt", sample_txt_bytes, "text/plain")},
            data={"model": "local"},
        )
        assert r.status_code == 200

    r = await async_client.post(
        "/api/v1/tag",
        files={"file": ("invoice.txt", sample_txt_bytes, "text/plain")},
        data={"model": "local"},
    )
    assert r.status_code == 429
