"""Shared FastAPI dependency helpers.

Re-exports the auth dependency under a friendly name and centralises any
future cross-cutting deps (rate limiters, request IDs, etc.).
"""
from __future__ import annotations

from fastapi import Depends

from src.auth import AuthContext, verify_jwt


def require_auth(ctx: AuthContext = Depends(verify_jwt)) -> AuthContext:
    """Use this in every endpoint that needs a logged-in caller."""
    return ctx


def require_role(*allowed: str):
    """Factory: returns a dep that enforces caller role membership."""

    def _checker(ctx: AuthContext = Depends(verify_jwt)) -> AuthContext:
        if ctx.role not in allowed:
            from fastapi import HTTPException, status
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{ctx.role}' not permitted; need one of {allowed}",
            )
        return ctx

    return _checker
