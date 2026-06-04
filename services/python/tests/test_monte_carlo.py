"""Unit tests for the pure Monte Carlo compute (no FastAPI, no I/O)."""
from __future__ import annotations

from src.models.monte_carlo import MonteCarloRequest
from src.routers.monte_carlo import _run_simulation


def _req(**over) -> MonteCarloRequest:
    base = dict(
        ar_growth_pct=80, churn_pct=8, gross_margin_pct=75,
        ltv_cac_ratio=4.5, multiple=12, base_arr_usd=5_000_000,
        runs=5_000, seed=42,
    )
    base.update(over)
    return MonteCarloRequest(**base)


def test_percentile_ordering():
    r = _run_simulation(_req())
    assert r["p10"] <= r["p25"] <= r["p50"] <= r["p75"] <= r["p90"]
    assert r["min"] <= r["p10"]
    assert r["p90"] <= r["max"]


def test_deterministic_with_seed():
    a = _run_simulation(_req(seed=7))
    b = _run_simulation(_req(seed=7))
    assert a["p50"] == b["p50"]
    assert a["mean"] == b["mean"]


def test_no_negative_valuation():
    # Brutal churn + tiny margin must never yield negative enterprise value
    r = _run_simulation(_req(churn_pct=95, gross_margin_pct=5, ar_growth_pct=-50))
    assert r["min"] >= 0


def test_histogram_50_bins_and_downsample():
    r = _run_simulation(_req(runs=20_000))
    assert len(r["histogram_bins"]) == 50
    assert len(r["distribution"]) <= 1_000
    total = sum(b.count for b in r["histogram_bins"])
    assert total == 20_000


def test_higher_growth_lifts_median():
    low = _run_simulation(_req(ar_growth_pct=20, seed=1))
    high = _run_simulation(_req(ar_growth_pct=120, seed=1))
    assert high["p50"] > low["p50"]
