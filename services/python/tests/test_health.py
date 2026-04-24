"""Smoke tests for /health and the auth dependency."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def client(mock_supabase, mock_anthropic):  # noqa: ARG001
    from src.main import app
    return TestClient(app)


def test_health_returns_ok(client):
    res = client.get("/health")
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "ok"
    assert body["version"] == "1.0.0"
    assert body["python"] == "3.12"
    assert body["supabase"] == "reachable"
    assert body["anthropic"] == "reachable"


def test_root_returns_metadata(client):
    res = client.get("/")
    assert res.status_code == 200
    body = res.json()
    assert body["service"] == "zeniipo-python-sidecar"
    assert body["health"] == "/health"


def test_protected_endpoint_rejects_missing_jwt(client):
    res = client.post(
        "/sensitivity/monte-carlo",
        json={
            "ar_growth_pct": 50, "churn_pct": 5,
            "gross_margin_pct": 75, "ltv_cac_ratio": 4,
            "multiple": 10,
        },
    )
    assert res.status_code == 401
    assert "Missing X-Zeniipo-Auth" in res.json()["detail"]


def test_protected_endpoint_rejects_bad_jwt(client):
    res = client.post(
        "/sensitivity/monte-carlo",
        headers={"X-Zeniipo-Auth": "Bearer not.a.jwt"},
        json={
            "ar_growth_pct": 50, "churn_pct": 5,
            "gross_margin_pct": 75, "ltv_cac_ratio": 4,
            "multiple": 10,
        },
    )
    assert res.status_code == 401


def test_monte_carlo_runs_with_valid_jwt(client, signed_jwt):
    res = client.post(
        "/sensitivity/monte-carlo",
        headers={"X-Zeniipo-Auth": f"Bearer {signed_jwt}"},
        json={
            "ar_growth_pct": 80,
            "churn_pct": 8,
            "gross_margin_pct": 75,
            "ltv_cac_ratio": 4.5,
            "multiple": 12,
            "base_arr_usd": 5_000_000,
            "runs": 500,
            "seed": 42,
        },
    )
    assert res.status_code == 200, res.text
    body = res.json()
    # Sanity: percentile ordering
    assert body["p10"] <= body["p25"] <= body["p50"] <= body["p75"] <= body["p90"]
    assert body["runs"] == 500
    assert len(body["histogram_bins"]) == 50
    assert len(body["distribution"]) <= 1_000
    assert body["mean"] > 0
