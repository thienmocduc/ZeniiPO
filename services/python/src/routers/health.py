"""GET /health — liveness + dependency reachability.

Public endpoint (no JWT required) — used by Railway/Fly health checks.
"""
from __future__ import annotations

import asyncio
import sys

from fastapi import APIRouter

from src import __version__
from src.anthropic_client import anthropic_health
from src.config import get_settings
from src.supabase_client import supabase_health

router = APIRouter(tags=["health"])


@router.get("/health")
async def health() -> dict:
    """Returns basic liveness + reachability of upstream services.

    Probes are run in parallel to keep the response under ~1s even if both
    upstreams are slow. Failures degrade to `unreachable` but the endpoint
    itself still returns 200 — the deploy platform can decide on alerting.
    """
    settings = get_settings()
    sb_ok, anth_ok = await asyncio.gather(
        supabase_health(),
        anthropic_health(),
        return_exceptions=False,
    )
    return {
        "status": "ok",
        "version": __version__,
        "python": f"{sys.version_info.major}.{sys.version_info.minor}",
        "environment": settings.ENVIRONMENT,
        "supabase": "reachable" if sb_ok else "unreachable",
        "anthropic": "reachable" if anth_ok else "unreachable",
    }


@router.get("/")
async def root() -> dict:
    """Friendly root endpoint."""
    return {
        "service": "zeniipo-python-sidecar",
        "version": __version__,
        "docs": "/docs",
        "health": "/health",
    }
