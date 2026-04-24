"""Shared-secret JWT verification.

Next.js signs a short-lived HS256 JWT with PYTHON_SHARED_SECRET, sends it
in `X-Zeniipo-Auth: Bearer <jwt>`. We verify it here. Same secret on both
sides — symmetric, no key rotation needed.

Claims:
    {
      "tenant_id": "uuid",
      "user_id": "uuid",
      "role": "chairman|ceo|c_level|...",
      "iat": 169...,
      "exp": 169...   # short — 5 min recommended
    }
"""
from __future__ import annotations

from dataclasses import dataclass

from fastapi import Header, HTTPException, status
from jose import JWTError, jwt

from src.config import get_settings

JWT_ALGORITHM = "HS256"


@dataclass
class AuthContext:
    """Validated caller identity, made available to handlers via Depends."""

    tenant_id: str
    user_id: str
    role: str
    raw_claims: dict


def _strip_bearer(value: str) -> str:
    """Accept either `Bearer <token>` or the raw token."""
    if value.lower().startswith("bearer "):
        return value[7:].strip()
    return value.strip()


def verify_jwt(
    x_zeniipo_auth: str | None = Header(default=None, alias="X-Zeniipo-Auth"),
) -> AuthContext:
    """FastAPI dependency — raises 401 on any auth failure.

    Use as: `def handler(ctx: AuthContext = Depends(verify_jwt))`.
    """
    if not x_zeniipo_auth:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing X-Zeniipo-Auth header",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = _strip_bearer(x_zeniipo_auth)
    settings = get_settings()

    try:
        claims = jwt.decode(
            token,
            settings.PYTHON_SHARED_SECRET,
            algorithms=[JWT_ALGORITHM],
            options={"require": ["exp", "iat"]},
        )
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {exc!s}",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc

    tenant_id = claims.get("tenant_id")
    user_id = claims.get("user_id")
    role = claims.get("role")

    if not (tenant_id and user_id and role):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing required claims (tenant_id, user_id, role)",
        )

    return AuthContext(
        tenant_id=str(tenant_id),
        user_id=str(user_id),
        role=str(role),
        raw_claims=claims,
    )
