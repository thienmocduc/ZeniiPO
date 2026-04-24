"""Anthropic SDK initialisation.

We use the async client for parallel dispatch (council, batch agents).
Default model: claude-opus-4-7 — overridable per-call.
"""
from __future__ import annotations

from functools import lru_cache

from anthropic import AsyncAnthropic

from src.config import get_settings


@lru_cache(maxsize=1)
def get_anthropic() -> AsyncAnthropic:
    """Cached async Anthropic client."""
    settings = get_settings()
    return AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)


async def anthropic_health() -> bool:
    """Reachability probe — sends a 1-token noop to verify network + auth."""
    try:
        client = get_anthropic()
        settings = get_settings()
        # Cheapest valid request: 1 token completion
        await client.messages.create(
            model=settings.ANTHROPIC_MODEL,
            max_tokens=1,
            messages=[{"role": "user", "content": "ping"}],
        )
        return True
    except Exception:  # noqa: BLE001 — health probe
        return False


# Approximate USD pricing per 1M tokens for cost estimation in /batch/agents.
# Adjust as Anthropic publishes new model prices.
PRICING_USD_PER_M_TOKENS: dict[str, dict[str, float]] = {
    "claude-opus-4-7-20251022": {"input": 15.00, "output": 75.00},
    "claude-sonnet-4-5": {"input": 3.00, "output": 15.00},
    "claude-haiku-4-5": {"input": 0.80, "output": 4.00},
}


def estimate_cost_usd(model: str, input_tokens: int, output_tokens: int) -> float:
    """Rough USD cost — used for tagging agent_runs rows. Not billing-accurate."""
    # Closest match: try exact then prefix
    rates = PRICING_USD_PER_M_TOKENS.get(model)
    if rates is None:
        for key, val in PRICING_USD_PER_M_TOKENS.items():
            if model.startswith(key.rsplit("-", 1)[0]):
                rates = val
                break
    if rates is None:
        rates = {"input": 3.00, "output": 15.00}  # fallback to Sonnet
    cost = (input_tokens * rates["input"] + output_tokens * rates["output"]) / 1_000_000
    return round(cost, 6)
