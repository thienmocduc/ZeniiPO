"""POST /council/validate — 9-expert parallel idea validation.

Each persona is a separate Claude call dispatched concurrently with
asyncio.gather. We extract a 0-100 score from each response and weight-
average for the overall verdict.
"""
from __future__ import annotations

import asyncio
import json
import logging
import re
import time
from typing import Any

from anthropic import APIError
from fastapi import APIRouter, Depends

from src.anthropic_client import get_anthropic
from src.auth import AuthContext
from src.config import get_settings
from src.deps import require_auth
from src.models.council import (
    CouncilRequest,
    CouncilResponse,
    ExpertVote,
    IdeaInput,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/council", tags=["council"])


# 9 expert personas — codename, dimension, weight, system prompt.
COUNCIL: list[dict[str, Any]] = [
    {
        "persona": "plutus-01",
        "dimension": "Financial viability",
        "weight": 0.15,
        "system": (
            "You are Plutus, a senior financial analyst from Goldman Sachs. "
            "Score the idea 0-100 on financial viability — unit economics, capital "
            "efficiency, path to profitability."
        ),
    },
    {
        "persona": "athena-01",
        "dimension": "Market & strategy",
        "weight": 0.15,
        "system": (
            "You are Athena, head of strategy at McKinsey. Score 0-100 on market "
            "fit, TAM, strategic moat, and timing."
        ),
    },
    {
        "persona": "hermes-01",
        "dimension": "Go-to-market",
        "weight": 0.10,
        "system": (
            "You are Hermes, a growth marketing veteran. Score 0-100 on GTM "
            "feasibility, channel strategy, CAC realism."
        ),
    },
    {
        "persona": "hephaestus-01",
        "dimension": "Tech feasibility",
        "weight": 0.12,
        "system": (
            "You are Hephaestus, principal engineer at FAANG. Score 0-100 on "
            "technical feasibility, architecture risk, build-vs-buy."
        ),
    },
    {
        "persona": "themis-01",
        "dimension": "Legal & compliance",
        "weight": 0.10,
        "system": (
            "You are Themis, securities lawyer + IPO counsel. Score 0-100 on "
            "regulatory risk, IP defensibility, jurisdiction risk."
        ),
    },
    {
        "persona": "ares-01",
        "dimension": "Competitive risk",
        "weight": 0.10,
        "system": (
            "You are Ares, competitive intelligence specialist. Score 0-100 on "
            "competitive moat — lower score = more vulnerable to incumbents."
        ),
    },
    {
        "persona": "aphrodite-01",
        "dimension": "User experience & brand",
        "weight": 0.08,
        "system": (
            "You are Aphrodite, design director ex-Apple. Score 0-100 on UX "
            "potential, brand differentiation, emotional resonance."
        ),
    },
    {
        "persona": "demeter-01",
        "dimension": "Talent & execution",
        "weight": 0.10,
        "system": (
            "You are Demeter, ex-VC partner specializing in founder evaluation. "
            "Score 0-100 on team-execution probability given typical founders."
        ),
    },
    {
        "persona": "apollo-01",
        "dimension": "IPO readiness",
        "weight": 0.10,
        "system": (
            "You are Apollo, IPO readiness advisor (PCAOB+SOX). Score 0-100 on "
            "long-term IPO viability — governance, audit, scale."
        ),
    },
]


def _build_user_prompt(idea: IdeaInput, extra: str | None) -> str:
    parts = [
        "Evaluate the following business idea.",
        "",
        f"## Description\n{idea.description}",
        f"## Industry\n{idea.industry}",
        f"## Market size\n{idea.market_size}",
        f"## Competition\n{idea.competition}",
    ]
    if extra:
        parts.append(f"## Additional context\n{extra}")
    parts.append(
        "\nReturn ONLY valid JSON in this shape:\n"
        "```json\n"
        "{\n"
        '  "score": 0-100,\n'
        '  "rationale": "1-3 sentence explanation",\n'
        '  "risks": ["..."],\n'
        '  "opportunities": ["..."]\n'
        "}\n```"
    )
    return "\n\n".join(parts)


_JSON_BLOCK_RE = re.compile(r"```(?:json)?\s*(\{.*?\})\s*```", re.DOTALL)


def _extract_json(text: str) -> dict | None:
    """Pull the first JSON object out of Claude's response — robust to fences."""
    if match := _JSON_BLOCK_RE.search(text):
        try:
            return json.loads(match.group(1))
        except json.JSONDecodeError:
            pass
    # Fallback: try first {...} span
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end > start:
        try:
            return json.loads(text[start : end + 1])
        except json.JSONDecodeError:
            return None
    return None


async def _call_one_expert(
    expert: dict[str, Any],
    user_prompt: str,
) -> ExpertVote:
    """Single Claude call — never raises; returns a vote with error= on failure."""
    started = time.perf_counter()
    client = get_anthropic()
    settings = get_settings()
    try:
        msg = await client.messages.create(
            model=settings.ANTHROPIC_MODEL,
            max_tokens=800,
            system=expert["system"],
            messages=[{"role": "user", "content": user_prompt}],
        )
        # Concatenate all text blocks
        text = "".join(
            block.text for block in msg.content if getattr(block, "type", None) == "text"
        )
        parsed = _extract_json(text)
        if not parsed:
            raise ValueError("Expert returned non-JSON output")

        score = int(max(0, min(100, parsed.get("score", 50))))
        return ExpertVote(
            persona=expert["persona"],
            dimension=expert["dimension"],
            weight=expert["weight"],
            score=score,
            rationale=str(parsed.get("rationale", "")).strip(),
            risks=[str(r) for r in parsed.get("risks", [])][:10],
            opportunities=[str(o) for o in parsed.get("opportunities", [])][:10],
            duration_ms=int((time.perf_counter() - started) * 1000),
        )
    except (APIError, ValueError, KeyError) as exc:
        logger.warning("council: %s failed: %s", expert["persona"], exc)
        return ExpertVote(
            persona=expert["persona"],
            dimension=expert["dimension"],
            weight=expert["weight"],
            score=50,  # neutral fallback
            rationale="Expert call failed; using neutral fallback.",
            duration_ms=int((time.perf_counter() - started) * 1000),
            error=str(exc),
        )


def _aggregate(votes: list[ExpertVote]) -> tuple[float, str, str]:
    """Weighted-average score → recommendation + summary."""
    total_w = sum(v.weight for v in votes) or 1
    overall = sum(v.score * v.weight for v in votes) / total_w
    overall = round(overall, 2)

    if overall >= 75:
        rec = "go"
    elif overall >= 55:
        rec = "revise"
    else:
        rec = "no_go"

    weakest = min(votes, key=lambda v: v.score)
    strongest = max(votes, key=lambda v: v.score)
    summary = (
        f"Overall {overall:.1f}/100 ({rec.upper()}). "
        f"Strongest: {strongest.dimension} ({strongest.score}). "
        f"Weakest: {weakest.dimension} ({weakest.score})."
    )
    return overall, rec, summary


@router.post("/validate", response_model=CouncilResponse)
async def validate_idea(
    req: CouncilRequest,
    ctx: AuthContext = Depends(require_auth),  # noqa: ARG001 — ctx for future tenant scoping
) -> CouncilResponse:
    """Dispatch 9 expert Claude calls in parallel, aggregate verdict.

    Sample curl:
        curl -X POST http://localhost:8000/council/validate \\
          -H 'Content-Type: application/json' \\
          -H 'X-Zeniipo-Auth: Bearer <jwt>' \\
          -d '{"idea":{"description":"...","industry":"SaaS",
                "market_size":"TAM $10B","competition":"..."}}'
    """
    started = time.perf_counter()
    user_prompt = _build_user_prompt(req.idea, req.extra_context)

    votes = await asyncio.gather(
        *[_call_one_expert(e, user_prompt) for e in COUNCIL]
    )

    overall, rec, summary = _aggregate(list(votes))

    return CouncilResponse(
        overall_score=overall,
        recommendation=rec,  # type: ignore[arg-type]
        summary=summary,
        votes=list(votes),
        total_duration_ms=int((time.perf_counter() - started) * 1000),
    )
