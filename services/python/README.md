# Zeniipo Python Sidecar

FastAPI service for Zeniipo's heavy compute that's awkward in Next.js serverless:

- **Monte Carlo** valuation simulations (numpy-vectorised, 100k runs <100ms)
- **9-expert Council validation** (parallel Claude calls with weighted scoring)
- **Batch agent runs** (run N agents from `agent_catalog` concurrently)

Deploys standalone — Railway, Fly.io, or Render. Talks to the same Supabase project as Next.js via the service-role key. Auth uses a shared HMAC JWT signed by Next.js.

---

## Architecture

```
Next.js (Vercel)  ──── X-Zeniipo-Auth: Bearer <JWT(HS256)>  ────►  Python Sidecar (Railway)
       │                                                                │
       └──────► Supabase (RLS, anon key) ◄──── service-role bypass ─────┘
                                              │
                                              └─── Anthropic (Opus 4.7)
```

Both sides hold the same `PYTHON_SHARED_SECRET`. Next.js mints a 5-minute JWT containing `{tenant_id, user_id, role}`; Python verifies it on every request.

---

## Quick start

### 1. Install [uv](https://github.com/astral-sh/uv) (Astral's fast Python resolver)

```bash
# macOS / Linux
curl -LsSf https://astral.sh/uv/install.sh | sh
# Windows (PowerShell)
irm https://astral.sh/uv/install.ps1 | iex
```

### 2. Set up env

```bash
cd services/python
cp .env.example .env
# Fill in:
#   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY  (from Supabase dashboard)
#   ANTHROPIC_API_KEY                         (console.anthropic.com)
#   PYTHON_SHARED_SECRET                      (run: openssl rand -base64 64)
```

The same `PYTHON_SHARED_SECRET` must be set on the Next.js side.

### 3. Install + run dev

```bash
uv sync                                # installs all deps including dev
uv run uvicorn src.main:app --reload --port 8000
```

Open [http://localhost:8000/docs](http://localhost:8000/docs) for the OpenAPI UI.

### 4. Run tests

```bash
uv run pytest -v
```

---

## Endpoints

All endpoints except `/health` and `/` require `X-Zeniipo-Auth: Bearer <jwt>`.

### `GET /health`

```json
{
  "status": "ok",
  "version": "1.0.0",
  "python": "3.12",
  "environment": "dev",
  "supabase": "reachable",
  "anthropic": "reachable"
}
```

### `POST /sensitivity/monte-carlo`

```bash
curl -X POST http://localhost:8000/sensitivity/monte-carlo \
  -H 'Content-Type: application/json' \
  -H "X-Zeniipo-Auth: Bearer $JWT" \
  -d '{
    "ar_growth_pct": 80,
    "churn_pct": 8,
    "gross_margin_pct": 75,
    "ltv_cac_ratio": 4.5,
    "multiple": 12,
    "base_arr_usd": 5000000,
    "runs": 10000
  }'
```

Sample response (truncated):

```json
{
  "p10": 31200000,
  "p25": 41800000,
  "p50": 55400000,
  "p75": 72100000,
  "p90": 91800000,
  "mean": 57900000,
  "std": 24500000,
  "runs": 10000,
  "histogram_bins": [{"lower": 0, "upper": 4000000, "count": 12}, ...],
  "distribution": [55400123.4, 41887331.2, ...],
  "persisted": false
}
```

### `POST /council/validate`

Dispatches 9 expert personas (Plutus, Athena, Hermes, Hephaestus, Themis, Ares, Aphrodite, Demeter, Apollo) in parallel and returns a weighted `go|revise|no_go` recommendation.

### `POST /batch/agents`

```json
{
  "agent_codes": ["plutus-01", "hermes-01"],
  "prompt": "Should we launch in Q3?",
  "mode": "standard"
}
```

Modes: `fast` (Haiku, 512 tokens), `standard` (Opus default, 2048), `deep` (Opus, 8192).

---

## Deploy

### Railway (recommended free tier)

1. Push this repo to GitHub.
2. New project → Deploy from GitHub → pick `Zeni-iPO`.
3. Set **Root Directory**: `services/python`.
4. Railway auto-detects the Dockerfile.
5. Add env vars (Settings → Variables): everything from `.env.example`.
6. Railway gives you a `*.up.railway.app` domain — paste it into Next.js as `PYTHON_API_URL`.

### Fly.io

```bash
cd services/python
flyctl launch --no-deploy --dockerfile Dockerfile
flyctl secrets set \
  SUPABASE_URL=... \
  SUPABASE_SERVICE_ROLE_KEY=... \
  ANTHROPIC_API_KEY=... \
  PYTHON_SHARED_SECRET=...
flyctl deploy
```

### Render

Web service → Docker → root dir `services/python` → set env vars in the dashboard.

### Local Docker

```bash
docker compose up --build
```

---

## Project layout

```
services/python/
├── pyproject.toml          # uv-managed deps
├── .python-version         # 3.12
├── .env.example
├── Dockerfile              # multi-stage, non-root
├── docker-compose.yml      # dev
├── src/
│   ├── main.py             # FastAPI app entry
│   ├── config.py           # pydantic-settings (loads .env)
│   ├── auth.py             # JWT verify (HS256, shared secret)
│   ├── deps.py             # FastAPI Depends helpers
│   ├── supabase_client.py  # service-role client
│   ├── anthropic_client.py # AsyncAnthropic + cost estimator
│   ├── routers/
│   │   ├── health.py
│   │   ├── monte_carlo.py
│   │   ├── council.py
│   │   └── batch.py
│   └── models/
│       ├── monte_carlo.py
│       └── council.py
└── tests/
    ├── conftest.py
    └── test_health.py
```

---

## Calling from Next.js

See `apps/web/src/lib/python.ts` in the parent repo. It signs the JWT with the same `PYTHON_SHARED_SECRET`, calls the sidecar, and returns the JSON. Use it like:

```ts
const result = await callPython('/sensitivity/monte-carlo', {
  ar_growth_pct: 80, churn_pct: 8, gross_margin_pct: 75,
  ltv_cac_ratio: 4.5, multiple: 12, runs: 10_000,
})
```

---

## Security notes

- `SUPABASE_SERVICE_ROLE_KEY` bypasses RLS — it lives **only** on this server, never in the browser.
- `PYTHON_SHARED_SECRET` is **identical** on Next.js and Python. Rotate it in both places at once.
- JWTs are short-lived (≤5 min) — no refresh logic needed.
- The container runs as non-root user `zeni`.
- Health check endpoint is public (needed for Railway/Fly probes); everything else requires JWT.
