"""POST /batch/agents — run N agents in parallel with mode-specific limits.

Each agent's system prompt is loaded from Supabase `agent_catalog`.
Result rows are inserted into `agent_runs` for audit trail.
"""
from __future__ import annotations

import asyncio
import logging
import time
from datetime import datetime, timezone
from typing import Any

from anthropic import APIError
from fastapi import APIRouter, Depends, HTTPException, status

from src.anthropic_client import estimate_cost_usd, get_anthropic
from src.auth import AuthContext
from src.config import get_settings
from src.deps import require_auth
from src.models.council import AgentRunResult, BatchAgentRequest
from src.supabase_client import get_supabase

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/batch", tags=["batch"])


# Mode → (max_tokens, model override or None)
MODE_PROFILE: dict[str, tuple[int, str | None]] = {
    "fast": (512, "claude-haiku-4-5"),
    "standard": (2_048, None),  # uses settings.ANTHROPIC_MODEL
    "deep": (8_192, "claude-opus-4-7-20251022"),
}


async def _load_agent_catalog(codes: list[str]) -> dict[str, dict[str, Any]]:
    """Fetch system prompts from Supabase. Falls back to a generic prompt
    if the row is missing — never blocks a run."""
    try:
        client = get_supabase()
        result = await asyncio.to_thread(
            lambda: client.table("agent_catalog")
            .select("code, name, system_prompt")
            .in_("code", codes)
            .execute()
        )
        rows = result.data or []
        return {row["code"]: row for row in rows}
    except Exception as exc:  # noqa: BLE001
        logger.warning("agent_catalog fetch failed: %s — using fallback prompts", exc)
        return {}


async def _persist_run(
    tenant_id: str,
    user_id: str,
    journey_id: str | None,
    result: AgentRunResult,
    prompt: str,
    mode: str,
) -> bool:
    """Best-effort insert into agent_runs."""
    try:
        client = get_supabase()
        payload = {
            "tenant_id": tenant_id,
            "user_id": user_id,
            "journey_id": journey_id,
            "agent_code": result.agent,
            "mode": mode,
            "prompt_preview": prompt[:500],
            "output_preview": result.output[:1_000],
            "tokens_input": result.tokens_input,
            "tokens_output": result.tokens_output,
            "cost_usd": result.cost_usd,
            "duration_ms": result.duration_ms,
            "error": result.error,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await asyncio.to_thread(
            lambda: client.table("agent_runs").insert(payload).execute()
        )
        return True
    except Exception as exc:  # noqa: BLE001
        logger.warning("agent_runs persist failed for %s: %s", result.agent, exc)
        return False


async def _run_one_agent(
    code: str,
    catalog_row: dict[str, Any] | None,
    prompt: str,
    max_tokens: int,
    model: str,
) -> AgentRunResult:
    """Single agent run — captures tokens, cost, duration. Never raises."""
    started = time.perf_counter()
    client = get_anthropic()
    system_prompt = (
        catalog_row.get("system_prompt") if catalog_row else None
    ) or f"You are agent {code}. Help the user with their request."

    try:
        msg = await client.messages.create(
            model=model,
            max_tokens=max_tokens,
            system=system_prompt,
            messages=[{"role": "user", "content": prompt}],
        )
        text = "".join(
            block.text for block in msg.content if getattr(block, "type", None) == "text"
        )
        usage_in = msg.usage.input_tokens if msg.usage else 0
        usage_out = msg.usage.output_tokens if msg.usage else 0
        return AgentRunResult(
            agent=code,
            output=text,
            tokens_input=usage_in,
            tokens_output=usage_out,
            cost_usd=estimate_cost_usd(model, usage_in, usage_out),
            duration_ms=int((time.perf_counter() - started) * 1000),
        )
    except APIError as exc:
        logger.warning("agent %s API error: %s", code, exc)
        return AgentRunResult(
            agent=code,
            output="",
            tokens_input=0,
            tokens_output=0,
            cost_usd=0.0,
            duration_ms=int((time.perf_counter() - started) * 1000),
            error=f"anthropic: {exc!s}",
        )
    except Exception as exc:  # noqa: BLE001
        logger.exception("agent %s unexpected error", code)
        return AgentRunResult(
            agent=code,
            output="",
            tokens_input=0,
            tokens_output=0,
            cost_usd=0.0,
            duration_ms=int((time.perf_counter() - started) * 1000),
            error=str(exc),
        )


@router.post("/agents", response_model=list[AgentRunResult])
async def batch_agents(
    req: BatchAgentRequest,
    ctx: AuthContext = Depends(require_auth),
) -> list[AgentRunResult]:
    """Run N agents in parallel. Returns one result per agent_code.

    Sample curl:
        curl -X POST http://localhost:8000/batch/agents \\
          -H 'Content-Type: application/json' \\
          -H 'X-Zeniipo-Auth: Bearer <jwt>' \\
          -d '{
            "agent_codes": ["plutus-01","hermes-01"],
            "prompt": "Should I launch this in Q3?",
            "mode": "standard"
          }'
    """
    if len(req.agent_codes) != len(set(req.agent_codes)):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Duplicate agent_codes are not allowed",
        )

    settings = get_settings()
    max_tokens, model_override = MODE_PROFILE[req.mode]
    model = model_override or settings.ANTHROPIC_MODEL

    catalog = await _load_agent_catalog(req.agent_codes)

    results = await asyncio.gather(
        *[
            _run_one_agent(code, catalog.get(code), req.prompt, max_tokens, model)
            for code in req.agent_codes
        ]
    )

    # Fire-and-forget persistence
    persistence = await asyncio.gather(
        *[
            _persist_run(ctx.tenant_id, ctx.user_id, req.journey_id, r, req.prompt, req.mode)
            for r in results
        ]
    )
    for r, ok in zip(results, persistence, strict=True):
        r.persisted = bool(ok)

    return list(results)
