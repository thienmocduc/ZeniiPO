"""Pydantic models for the 9-expert council validation."""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class IdeaInput(BaseModel):
    description: str = Field(..., min_length=20, max_length=4_000)
    industry: str = Field(..., max_length=120)
    market_size: str = Field(..., max_length=200, description="TAM/SAM/SOM free-text")
    competition: str = Field(..., max_length=2_000)


class CouncilRequest(BaseModel):
    idea: IdeaInput
    extra_context: str | None = Field(default=None, max_length=8_000)


class ExpertVote(BaseModel):
    persona: str = Field(..., description="Expert codename, e.g. plutus-01")
    dimension: str = Field(..., description="What this expert evaluates")
    score: int = Field(..., ge=0, le=100)
    weight: float = Field(..., ge=0, le=1)
    rationale: str
    risks: list[str] = Field(default_factory=list)
    opportunities: list[str] = Field(default_factory=list)
    duration_ms: int = 0
    error: str | None = None


class CouncilResponse(BaseModel):
    overall_score: float = Field(..., ge=0, le=100)
    recommendation: Literal["go", "revise", "no_go"]
    summary: str
    votes: list[ExpertVote]
    total_duration_ms: int


class BatchAgentRequest(BaseModel):
    agent_codes: list[str] = Field(..., min_length=1, max_length=20)
    prompt: str = Field(..., min_length=1, max_length=20_000)
    mode: Literal["fast", "standard", "deep"] = "standard"
    journey_id: str | None = None


class AgentRunResult(BaseModel):
    agent: str
    output: str
    tokens_input: int
    tokens_output: int
    cost_usd: float
    duration_ms: int
    error: str | None = None
    persisted: bool = False
