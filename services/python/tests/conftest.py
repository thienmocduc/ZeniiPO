"""Test fixtures — mock upstream services, set required env vars."""
from __future__ import annotations

import os
from collections.abc import Iterator

import pytest


@pytest.fixture(autouse=True, scope="session")
def _set_env() -> Iterator[None]:
    """Provide minimum env vars so Settings() doesn't fail at import."""
    defaults = {
        "SUPABASE_URL": "https://test.supabase.co",
        "SUPABASE_SERVICE_ROLE_KEY": "test-service-role-key-aaaaaaaaaa",
        "ANTHROPIC_API_KEY": "sk-ant-test-bbbbbbbbbbbbbbbbbbbb",
        "PYTHON_SHARED_SECRET": "x" * 64,
        "ENVIRONMENT": "dev",
        "LOG_LEVEL": "WARNING",
        "ALLOWED_ORIGINS": "http://localhost:3000",
    }
    saved = {}
    for k, v in defaults.items():
        saved[k] = os.environ.get(k)
        os.environ[k] = v
    yield
    for k, v in saved.items():
        if v is None:
            os.environ.pop(k, None)
        else:
            os.environ[k] = v


@pytest.fixture
def mock_supabase(monkeypatch):
    """Replace get_supabase + supabase_health with no-op success."""
    from src import supabase_client

    class _FakeChain:
        def select(self, *_a, **_k): return self
        def insert(self, *_a, **_k): return self
        def in_(self, *_a, **_k): return self
        def limit(self, *_a, **_k): return self
        def execute(self): return type("R", (), {"data": []})()

    class _FakeClient:
        def table(self, _name): return _FakeChain()

    monkeypatch.setattr(supabase_client, "get_supabase", lambda: _FakeClient())

    async def _ok():
        return True
    monkeypatch.setattr(supabase_client, "supabase_health", _ok)


@pytest.fixture
def mock_anthropic(monkeypatch):
    """Replace anthropic_health with success; full Anthropic mocking is per-test."""
    from src import anthropic_client

    async def _ok():
        return True
    monkeypatch.setattr(anthropic_client, "anthropic_health", _ok)


@pytest.fixture
def signed_jwt() -> str:
    """Sign a valid JWT with the test secret."""
    import time as _time

    from jose import jwt

    claims = {
        "tenant_id": "tenant-abc",
        "user_id": "user-xyz",
        "role": "ceo",
        "iat": int(_time.time()),
        "exp": int(_time.time()) + 300,
    }
    return jwt.encode(claims, "x" * 64, algorithm="HS256")
