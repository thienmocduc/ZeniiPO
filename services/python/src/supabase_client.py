"""Supabase service-role client — bypasses RLS.

Use ONLY from server-side code. Never expose this client or the key to
the browser. All RLS-aware queries should still happen via the Next.js
side using the user's session.
"""
from __future__ import annotations

from functools import lru_cache

from supabase import Client, create_client

from src.config import get_settings


@lru_cache(maxsize=1)
def get_supabase() -> Client:
    """Lazily-initialised, cached service-role client."""
    settings = get_settings()
    return create_client(
        settings.SUPABASE_URL,
        settings.SUPABASE_SERVICE_ROLE_KEY,
    )


async def supabase_health() -> bool:
    """Lightweight reachability probe — does NOT require any specific table.

    We hit the auth `/settings` endpoint via the SDK's stored URL using a
    quick query against an information_schema view that always exists.
    Returns True on success, False otherwise.
    """
    try:
        client = get_supabase()
        # Cheapest possible reachability check
        client.table("information_schema.tables").select("table_name").limit(1).execute()
        return True
    except Exception:  # noqa: BLE001 — health check, swallow everything
        return False
