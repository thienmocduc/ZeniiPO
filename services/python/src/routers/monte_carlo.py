"""POST /sensitivity/monte-carlo — Gaussian Monte Carlo on valuation drivers.

Vectorised numpy — 100k runs finishes in <100ms on modern hardware.
"""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone

import numpy as np
from fastapi import APIRouter, Depends

from src.auth import AuthContext
from src.deps import require_auth
from src.models.monte_carlo import (
    MonteCarloHistogramBin,
    MonteCarloRequest,
    MonteCarloResponse,
)
from src.supabase_client import get_supabase

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/sensitivity", tags=["sensitivity"])


def _run_simulation(req: MonteCarloRequest) -> dict:
    """Pure compute — separated so it's easy to unit test without FastAPI."""
    rng = np.random.default_rng(req.seed)

    runs = req.runs

    # Draw Gaussian samples around each mean (sigma is fraction of mean).
    growth = rng.normal(req.ar_growth_pct, abs(req.ar_growth_pct) * req.sigma_ar_growth, runs)
    churn = rng.normal(req.churn_pct, max(req.churn_pct, 1.0) * req.sigma_churn, runs)
    margin = rng.normal(req.gross_margin_pct, req.gross_margin_pct * req.sigma_margin, runs)
    ltv_cac = rng.normal(req.ltv_cac_ratio, req.ltv_cac_ratio * req.sigma_ltv_cac, runs)
    multiple = rng.normal(req.multiple, req.multiple * req.sigma_multiple, runs)

    # Clamp to plausible ranges to avoid negative valuations dominating tails
    growth = np.clip(growth, -100, 1_000)
    churn = np.clip(churn, 0, 100)
    margin = np.clip(margin, 0, 100)
    ltv_cac = np.clip(ltv_cac, 0, 50)
    multiple = np.clip(multiple, 0, 100)

    # Valuation model:
    #   projected_arr = base_arr * (1 + growth/100) * (1 - churn/100)
    #   quality_factor = (margin/100) * (ltv_cac/3)   # 3:1 baseline
    #   valuation = projected_arr * multiple * quality_factor
    projected_arr = req.base_arr_usd * (1 + growth / 100.0) * (1 - churn / 100.0)
    quality_factor = (margin / 100.0) * (ltv_cac / 3.0)
    valuations = projected_arr * multiple * quality_factor
    valuations = np.maximum(valuations, 0)  # no negative enterprise value

    # Percentiles
    p10, p25, p50, p75, p90 = np.percentile(valuations, [10, 25, 50, 75, 90])
    mean_v = float(valuations.mean())
    std_v = float(valuations.std())

    # Histogram — 50 bins
    counts, edges = np.histogram(valuations, bins=50)
    bins = [
        MonteCarloHistogramBin(
            lower=float(edges[i]),
            upper=float(edges[i + 1]),
            count=int(counts[i]),
        )
        for i in range(len(counts))
    ]

    # Down-sample distribution to <=1000 points for the client chart
    if runs > 1_000:
        idx = rng.choice(runs, size=1_000, replace=False)
        sample = valuations[idx]
    else:
        sample = valuations
    distribution = sample.tolist()

    return {
        "p10": float(p10),
        "p25": float(p25),
        "p50": float(p50),
        "p75": float(p75),
        "p90": float(p90),
        "mean": mean_v,
        "std": std_v,
        "min": float(valuations.min()),
        "max": float(valuations.max()),
        "runs": runs,
        "histogram_bins": bins,
        "distribution": distribution,
    }


async def _persist_to_kpi_metrics(
    journey_id: str,
    tenant_id: str,
    user_id: str,
    result: dict,
) -> bool:
    """Best-effort write to Supabase. Never raise — we don't want to lose a result."""
    try:
        client = get_supabase()
        payload = {
            "journey_id": journey_id,
            "tenant_id": tenant_id,
            "created_by": user_id,
            "metric_type": "monte_carlo_valuation",
            "p10": result["p10"],
            "p50": result["p50"],
            "p90": result["p90"],
            "mean": result["mean"],
            "std": result["std"],
            "runs": result["runs"],
            "computed_at": datetime.now(timezone.utc).isoformat(),
        }
        # Run blocking insert in thread pool
        await asyncio.to_thread(
            lambda: client.table("kpi_metrics").insert(payload).execute()
        )
        return True
    except Exception as exc:  # noqa: BLE001
        logger.warning("kpi_metrics persist failed: %s", exc)
        return False


@router.post("/monte-carlo", response_model=MonteCarloResponse)
async def monte_carlo(
    req: MonteCarloRequest,
    ctx: AuthContext = Depends(require_auth),
) -> MonteCarloResponse:
    """Run a Gaussian Monte Carlo simulation on valuation drivers.

    Sample curl:
        curl -X POST http://localhost:8000/sensitivity/monte-carlo \\
          -H 'Content-Type: application/json' \\
          -H 'X-Zeniipo-Auth: Bearer <jwt>' \\
          -d '{
            "ar_growth_pct": 80,
            "churn_pct": 8,
            "gross_margin_pct": 75,
            "ltv_cac_ratio": 4.5,
            "multiple": 12,
            "base_arr_usd": 5000000,
            "runs": 10000
          }'
    """
    # numpy is sync but fast — push to a thread to keep the loop responsive
    result = await asyncio.to_thread(_run_simulation, req)

    persisted = False
    if req.journey_id:
        persisted = await _persist_to_kpi_metrics(
            req.journey_id, ctx.tenant_id, ctx.user_id, result
        )

    return MonteCarloResponse(**result, persisted=persisted)
