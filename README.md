# Smart Document Tagging API

A production-ready REST API that classifies uploaded documents (PDF, DOCX, plain text) into business categories using zero-shot NLP, with a modern React UI (TanStack Start) for interactive tagging and analytics.

## Features

- **POST /api/v1/tag** — accepts a document, extracts text, returns multi-label tags with confidence scores
- **8-category taxonomy**: Invoice, Contract, Specification, Report, Memo, Proposal, NDA, Policy
- **Key sentence extraction** — highlights the most relevant sentences per tag
- **React UI** (TanStack Start) — drag-and-drop upload, results view, analytics dashboard, settings
- **Dockerized** — single `docker compose up` to run everything
- **Rate limiting** — 5 requests/minute/IP via SlowAPI
- **Structured JSON logging** via structlog
- **Prometheus metrics** — `/metrics` endpoint with HTTP + custom model metrics; optional Grafana stack
- **CI/CD** via GitHub Actions (lint → test → docker build)

## Approach & design decisions

A short tour of the tools and models chosen, and **why**:

- **Classification without training data.** The taxonomy is fixed (8 business categories), so
  rather than collect labels and fine-tune a model, the API uses **zero-shot** approaches that
  work out of the box:
  - **BGE-small embeddings (default)** — embed the document and each category *description*,
    rank by cosine similarity, softmax into 0–1 scores. Tiny (~130 MB) and fast on CPU.
  - **BART zero-shot (NLI)** — poses "this document is a {label}" and scores entailment;
    heavier but reasons about each label more directly.
  - **OpenAI embeddings** — same similarity pipeline as BGE but using OpenAI's higher-quality
    (paid) vectors. The OpenAI and local-embedding paths share one pipeline
    (`services/embedding_common.py`); only the embedding step differs.
  Three backends let the user trade off **speed vs. accuracy vs. cost/privacy** — see
  [Choosing a model](#choosing-a-model).
- **FastAPI + Pydantic** — typed, async, with automatic OpenAPI docs at `/docs`; settings via
  `pydantic-settings` (env/`.env`).
- **Robust extraction** — `pdfplumber` (PDF), `python-docx` (DOCX), with `python-magic` MIME
  sniffing so files are validated by content, not just extension.
- **Production hygiene** — `structlog` JSON logs with per-request IDs, Prometheus `/metrics`
  (HTTP + custom model metrics), `SlowAPI` rate limiting, narrow CORS, non-root multi-stage
  Docker images pinned by digest.
- **Frontend** — React + TanStack Start (SSR) with Tailwind; drag-and-drop upload, results,
  a session analytics dashboard, a model picker, and a dark-mode toggle. Model and API URL
  are configurable from the UI, stored in the browser.
- **Lean by default** — `docker compose up` runs the whole stack; only the ~130 MB default
  model downloads on first boot (the 1.6 GB BART model is fetched lazily, only if selected).

## Quick Start

### Option A: Docker (recommended)

```bash
docker compose up --build
```

- API: http://localhost:8000 | Docs: http://localhost:8000/docs
- UI: http://localhost:3000

> **First boot:** the default model (**BGE-small, ~130 MB**) downloads automatically into
> the `hf_cache` volume, which Docker Compose creates for you. The download happens once and
> persists across restarts. The heavier BART model (~1.6 GB) is fetched lazily only if you
> select it on the Settings page. See [Choosing a model](#choosing-a-model).
>
> **Offline / air-gapped?** The default keeps the image lean by caching the model in a volume
> at first run. If you need a fully self-contained image with no runtime download, add a build
> step to the API `Dockerfile` that pre-fetches the model — e.g.
> `RUN python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('BAAI/bge-small-en-v1.5')"`.

### Option B: Local development

**Prerequisites:** Python 3.11+, `uv` (`pip install uv`)

```bash
# Install API + dev dependencies (CPU-only torch)
uv pip install --extra-index-url https://download.pytorch.org/whl/cpu ".[dev]"

# Windows: python-magic-bin is included automatically in dev group
# Linux/macOS: ensure libmagic is installed (apt install libmagic1 / brew install libmagic)

# Copy env
cp .env.example .env

# Run API (downloads the default BGE-small model on first start, ~130 MB)
uvicorn document_tagger.main:app --reload
```

**Frontend** (React / TanStack Start, requires [Bun](https://bun.sh)):

```bash
cd frontend
bun install
bun run dev
```

- UI dev server: http://localhost:5173
- The UI calls the API at `http://localhost:8000/api/v1` by default; change it any time on the **Settings** page.

## API Reference

### `POST /api/v1/tag`

**Request:** `multipart/form-data`

| Field | Type | Description |
|---|---|---|
| `file` | File | PDF, DOCX, or TXT — max 10 MB |
| `model` | string | Backend id: `bge-small` (default), `local`, `openai-3-small`, or `openai-3-large` — see [Choosing a model](#choosing-a-model) |
| `include_text` | bool | Return the extracted text in the response (default: false) |

**Example request** — default model (BGE-small, local, no key, ~130 MB). Omitting `model`
uses the default:

```bash
curl -s -X POST http://localhost:8000/api/v1/tag \
  -F "file=@docs/samples/invoice_sample.txt"
```

**Example response:**

```json
{
  "tags": [
    { "category": "Invoice", "confidence": 0.8874 }
  ],
  "key_sentences": [
    "Late payments are subject to a 1.5% monthly finance charge.",
    "Thank you for your business."
  ],
  "extraction_char_count": 907,
  "extracted_text": null,
  "model_version": "BAAI/bge-small-en-v1.5",
  "backend": "bge-small"
}
```

> `extracted_text` is `null` unless you pass `-F "include_text=true"`, in which case
> it holds the full text extracted from the document.

**Other backends** — set the `model` field. `model=local` uses BART zero-shot (more nuanced;
downloads ~1.6 GB on first use). The OpenAI backends require your own key, sent per-request in
the `X-OpenAI-Key` header (never logged or stored):

```bash
curl -s -X POST http://localhost:8000/api/v1/tag \
  -H "X-OpenAI-Key: sk-..." \
  -F "file=@docs/samples/contract_sample.txt" \
  -F "model=openai-3-small"
```

### `GET /api/v1/health`

```json
{ "status": "ok", "model_loaded": true, "version": "0.1.0" }
```

## Running Tests

Tests run without downloading the model — the classifier is mocked.

```bash
pytest tests/ -v --cov=document_tagger
```

## Choosing a model

Four backends are available, picked on the **Settings** page or via the `/tag` `model` field.
Two run **locally** (free, private — nothing leaves your machine); two use **OpenAI** (paid,
your text is sent to OpenAI). **`bge-small` is the default.**

| Model | `model` id | Type | Size | Speed | Cost / privacy |
|---|---|---|---|---|---|
| **BGE-small** (default) | `bge-small` | Local embeddings (`BAAI/bge-small-en-v1.5`) | ~130 MB, 384-dim | Fast | Free, fully local |
| **BART zero-shot** | `local` | Local zero-shot NLI (`facebook/bart-large-mnli`) | ~1.6 GB | Slow | Free, fully local |
| **text-embedding-3-small** | `openai-3-small` | OpenAI cloud embeddings | — | Fast | Paid, text sent to OpenAI |
| **text-embedding-3-large** | `openai-3-large` | OpenAI cloud embeddings | — | Fast | Paid, text sent to OpenAI |

**Which is better for what — and why:**

- **BGE-small (default) — fastest & lightest.** It classifies by embedding the document and
  comparing it to each category description by cosine similarity. ~12× smaller than BART and
  much faster on CPU. *Best for most documents and when you care about speed and footprint.*
- **BART zero-shot — most thorough.** It poses "this document is a {label}" for every category
  and scores entailment with a natural-language-inference model, so it reasons about each label
  more directly. Heavier (~1.6 GB) and slower. *Best for tricky or ambiguous documents where
  nuance matters more than speed.* (Downloads lazily the first time you select it.)
- **OpenAI embeddings (3-small / 3-large) — top quality, paid.** Highest embedding quality;
  `3-large` is the most accurate, `3-small` is the best value. *Best when you want maximum
  accuracy and don't mind sending text to OpenAI* (requires your own API key via the
  `X-OpenAI-Key` header).

> Both local models need no account or key. The default `docker compose up` downloads only the
> ~130 MB BGE model on first boot; BART's 1.6 GB is fetched only if you choose it.

Sources: HF model cards for
[bge-small-en-v1.5](https://huggingface.co/BAAI/bge-small-en-v1.5) (33.4M params, 384-dim) and
[bart-large-mnli](https://huggingface.co/facebook/bart-large-mnli) (~407M params).

## Monitoring & Observability

The API exposes Prometheus metrics at **`GET /metrics`** (always on, no config needed):

- **HTTP RED metrics** (request rate, errors, latency) — emitted automatically for every endpoint.
- **Custom model metrics:**
  | Metric | Type | Labels | Tells you |
  |---|---|---|---|
  | `document_tag_predictions_total` | counter | `backend`, `category` | Volume and class mix of predictions |
  | `document_tag_classify_duration_seconds` | histogram | `backend` | Classifier latency (compare local vs OpenAI) |
  | `document_tag_top_confidence` | histogram | `backend` | Confidence distribution — e.g. whether `TAG_CONFIDENCE_THRESHOLD` is well-calibrated |

  Labels are deliberately low-cardinality (backend ∈ 3, category ∈ 8) — never per-document.

```bash
curl -s http://localhost:8000/metrics | grep document_tag
```

### Optional dashboards (Prometheus + Grafana)

Self-hosted, local-only, **no account required**. Gated behind a Compose profile so the
default `docker compose up` stays lean:

```bash
docker compose --profile monitoring up
```

- Prometheus: http://localhost:9090 (scrapes the API every 15s)
- Grafana: http://localhost:3001 (opens with no login; Prometheus datasource pre-provisioned)

> **Scale-up path:** for distributed/production observability, the standard next step is
> OpenTelemetry (traces + metrics + logs) exported to a stack like Grafana
> Tempo/Loki/Prometheus. Model *drift* detection (PSI/KS) is intentionally omitted — it
> isn't meaningful for a stateless zero-shot classifier with no training baseline.

## Sample Documents

Eight TXT samples (one per category) are in `docs/samples/`, one for each business category.

To also generate PDF and DOCX samples:

```bash
pip install fpdf2 python-docx
python docs/samples/create_binary_samples.py
```

## Project Structure

```
src/document_tagger/
├── core/         config.py, logging.py, metrics.py
├── api/v1/       router.py, schemas.py
├── services/     classifier.py (BART), extractor.py, registry.py,
│                 embedding_common.py (shared pipeline),
│                 embedding_classifier.py (OpenAI), local_embedding_classifier.py (BGE)
└── utils/        validators.py
frontend/         React / TanStack Start UI (Vite, Bun, Tailwind)
└── src/routes/   index (upload), results, analytics, settings
monitoring/       Prometheus config + Grafana provisioning (optional `monitoring` profile)
tests/            unit + integration (offline — models mocked, no downloads)
```

## Configuration

All settings read from environment variables or `.env`:

| Variable | Default | Description |
|---|---|---|
| `LOCAL_EMBEDDING_SOFTMAX_TEMPERATURE` | `0.04` | BGE (default model) confidence sharpness — lower = sharper |
| `LOCAL_EMBEDDING_TAG_THRESHOLD` | `0.05` | BGE minimum score to include a tag |
| `LOCAL_EMBEDDING_MAX_CLASSIFY_CHARS` | `2000` | Max chars sent to BGE (~512-token cap) |
| `HF_MODEL_NAME` | `facebook/bart-large-mnli` | The non-default BART zero-shot classifier (used by `model=local`) |
| `TAG_CONFIDENCE_THRESHOLD` | `0.97` | BART minimum score to include a tag |
| `MAX_FILE_SIZE_BYTES` | `10485760` | 10 MB |
| `RATE_LIMIT_TAG_ENDPOINT` | `5/minute` | Per-IP rate limit |
| `CORS_ALLOW_ORIGINS` | `http://localhost:3000,http://localhost:5173` | Comma-separated browser origins allowed to call the API |
| `DEBUG` | `false` | Human-readable logs when true |

### Frontend build-time config

| Variable | Default | Description |
|---|---|---|
| `VITE_API_BASE_URL` | `http://localhost:8000/api/v1` | API base URL baked into the UI bundle at build time |

`VITE_API_BASE_URL` is inlined by Vite when the frontend is built, so it must be
set at **build** time, not run time. Under Docker it's a build arg
(`docker-compose.yml` → `frontend.build.args`); for local dev, put it in
`frontend/.env`. Override it when the API is not on `localhost` — e.g. when the
stack runs on a remote host accessed from your laptop. You can also change the
API URL at any time from the UI's **Settings** page (stored in your browser).
