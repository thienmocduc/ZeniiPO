# syntax=docker/dockerfile:1.7
# Multi-stage build for Zeniipo Python sidecar
# Stage 1: builder — installs deps with uv
FROM python:3.12-slim AS builder

ENV UV_SYSTEM_PYTHON=1 \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

# Install uv (Astral's fast resolver)
COPY --from=ghcr.io/astral-sh/uv:0.5.4 /uv /usr/local/bin/uv

WORKDIR /app

# Install build deps (numpy/scipy may need)
RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential \
        curl \
    && rm -rf /var/lib/apt/lists/*

# Copy dep manifest first for cache
COPY pyproject.toml ./
COPY uv.lock* ./

# Install runtime deps (no dev)
RUN uv sync --frozen --no-dev || uv sync --no-dev

# Stage 2: runtime — minimal slim image
FROM python:3.12-slim AS runtime

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PATH="/app/.venv/bin:$PATH"

# Non-root user
RUN groupadd -r zeni && useradd -r -g zeni -d /app -s /sbin/nologin zeni

WORKDIR /app

# Copy venv from builder
COPY --from=builder /app/.venv /app/.venv

# Copy source
COPY --chown=zeni:zeni src/ ./src/
COPY --chown=zeni:zeni pyproject.toml ./

USER zeni

EXPOSE 8000

# Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD python -c "import urllib.request,sys; \
                 r=urllib.request.urlopen('http://localhost:8000/health',timeout=3); \
                 sys.exit(0 if r.status==200 else 1)" || exit 1

CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
