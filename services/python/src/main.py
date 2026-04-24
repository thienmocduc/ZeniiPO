"""FastAPI app entry — wires routers, middleware, error handlers.

Run dev:
    uv run uvicorn src.main:app --reload --port 8000

Run prod (Docker handles this):
    uvicorn src.main:app --host 0.0.0.0 --port 8000 --workers 2
"""
from __future__ import annotations

import logging
import time
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from src import __version__
from src.config import get_settings
from src.routers import batch, council, health, monte_carlo


def _configure_logging(level: str) -> None:
    logging.basicConfig(
        level=level,
        format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
    )


@asynccontextmanager
async def lifespan(app: FastAPI):  # noqa: ARG001
    """Startup / shutdown hooks."""
    settings = get_settings()
    _configure_logging(settings.LOG_LEVEL)
    logger = logging.getLogger("zeniipo.startup")
    logger.info(
        "Booting zeniipo-python-sidecar v%s in %s",
        __version__,
        settings.ENVIRONMENT,
    )
    # Eagerly instantiate clients so any boot-time config error fails fast.
    try:
        from src.anthropic_client import get_anthropic
        from src.supabase_client import get_supabase
        get_supabase()
        get_anthropic()
    except Exception:
        logger.exception("Failed to initialise upstream clients")
        raise
    yield
    logger.info("Shutting down zeniipo-python-sidecar")


app = FastAPI(
    title="Zeniipo Python Sidecar",
    description=(
        "Heavy-compute service for Zeniipo: Monte Carlo simulations, "
        "9-expert council validation, batch Claude agent runs."
    ),
    version=__version__,
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS — Next.js + admin domains. Production should be tight.
_settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=_settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "X-Zeniipo-Auth", "Authorization"],
    max_age=600,
)


@app.middleware("http")
async def request_id_and_timing(request: Request, call_next):
    """Attach request_id, log timing for every request."""
    req_id = request.headers.get("X-Request-Id") or str(uuid.uuid4())
    started = time.perf_counter()
    response = await call_next(request)
    duration_ms = int((time.perf_counter() - started) * 1000)
    response.headers["X-Request-Id"] = req_id
    response.headers["X-Response-Time-ms"] = str(duration_ms)
    logging.getLogger("zeniipo.access").info(
        "%s %s -> %s in %dms (req_id=%s)",
        request.method,
        request.url.path,
        response.status_code,
        duration_ms,
        req_id,
    )
    return response


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    """Last-resort handler — never leak stack traces in prod."""
    logging.getLogger("zeniipo.error").exception(
        "Unhandled error on %s %s", request.method, request.url.path
    )
    settings = get_settings()
    detail = str(exc) if not settings.is_prod else "Internal server error"
    return JSONResponse(status_code=500, content={"detail": detail})


# Routers
app.include_router(health.router)
app.include_router(monte_carlo.router)
app.include_router(council.router)
app.include_router(batch.router)
