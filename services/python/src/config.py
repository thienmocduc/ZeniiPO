"""Application configuration loaded from environment variables.

Uses pydantic-settings — never hard-code secrets. All values come from .env
or the deploy platform's env management (Railway, Fly.io, Render).
"""
from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime settings — fail-fast at boot if anything required is missing."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    # Supabase (service-role key — server-side only, never expose to client)
    SUPABASE_URL: str = Field(..., description="Supabase project URL")
    SUPABASE_SERVICE_ROLE_KEY: str = Field(..., description="Service-role key — bypasses RLS")

    # Anthropic
    ANTHROPIC_API_KEY: str = Field(..., description="Anthropic API key")
    ANTHROPIC_MODEL: str = Field(
        default="claude-opus-4-7-20251022",
        description="Default model — Opus 4.7 latest. Override per request if needed.",
    )

    # Shared secret for JWT auth between Next.js and Python
    PYTHON_SHARED_SECRET: str = Field(
        ...,
        min_length=32,
        description="HMAC secret for JWT — same value on Next.js side",
    )

    # Server
    PORT: int = Field(default=8000, ge=1, le=65535)
    ENVIRONMENT: Literal["dev", "staging", "prod"] = "dev"
    LOG_LEVEL: Literal["DEBUG", "INFO", "WARNING", "ERROR"] = "INFO"

    # CORS
    ALLOWED_ORIGINS: str = Field(
        default="http://localhost:3000",
        description="Comma-separated allowed origins",
    )

    @property
    def allowed_origins_list(self) -> list[str]:
        return [o.strip() for o in self.ALLOWED_ORIGINS.split(",") if o.strip()]

    @property
    def is_prod(self) -> bool:
        return self.ENVIRONMENT == "prod"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Cached settings — instantiated once per process."""
    return Settings()  # type: ignore[call-arg]
