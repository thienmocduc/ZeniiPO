"""Pydantic models for Monte Carlo sensitivity analysis."""
from __future__ import annotations

from pydantic import BaseModel, Field


class MonteCarloRequest(BaseModel):
    """Inputs for a Monte Carlo valuation simulation.

    Each numeric input is treated as the MEAN of a Gaussian; we draw
    `runs` samples per variable and compute valuation = ARR * multiple
    after applying churn + margin + LTV/CAC adjustments.
    """

    ar_growth_pct: float = Field(..., ge=-100, le=1000, description="Annual revenue growth %")
    churn_pct: float = Field(..., ge=0, le=100, description="Annual customer churn %")
    gross_margin_pct: float = Field(..., ge=0, le=100, description="Gross margin %")
    ltv_cac_ratio: float = Field(..., ge=0, le=50, description="LTV / CAC ratio")
    multiple: float = Field(..., ge=0, le=100, description="Revenue multiple (x)")
    base_arr_usd: float = Field(default=1_000_000, ge=0, description="Base ARR for valuation")

    runs: int = Field(default=1_000, ge=100, le=100_000, description="# Monte Carlo runs")
    seed: int | None = Field(default=None, description="Optional RNG seed for reproducibility")

    # Per-variable std-dev (% of mean). Sensible defaults — caller may override.
    sigma_ar_growth: float = Field(default=0.20, ge=0, le=2)
    sigma_churn: float = Field(default=0.30, ge=0, le=2)
    sigma_margin: float = Field(default=0.10, ge=0, le=2)
    sigma_ltv_cac: float = Field(default=0.25, ge=0, le=2)
    sigma_multiple: float = Field(default=0.20, ge=0, le=2)

    journey_id: str | None = Field(default=None, description="If set, persist to kpi_metrics")


class MonteCarloHistogramBin(BaseModel):
    lower: float
    upper: float
    count: int


class MonteCarloResponse(BaseModel):
    p10: float
    p25: float
    p50: float
    p75: float
    p90: float
    mean: float
    std: float
    min: float
    max: float
    runs: int
    histogram_bins: list[MonteCarloHistogramBin]
    distribution: list[float] = Field(
        default_factory=list,
        description="Down-sampled distribution (max 1000 points) for client charts",
    )
    persisted: bool = Field(default=False, description="Was the result written to Supabase?")
