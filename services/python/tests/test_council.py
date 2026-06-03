"""Council validation tests — pure helpers + endpoint with mocked Anthropic."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from src.models.council import ExpertVote
from src.routers.council import COUNCIL, _aggregate, _extract_json


# ─── pure helpers ──────────────────────────────────────────────
def test_council_has_9_experts():
    assert len(COUNCIL) == 9
    # weights sum to ~1.0
    assert abs(sum(e["weight"] for e in COUNCIL) - 1.0) < 0.001


def test_extract_json_from_fence():
    text = 'Here is my verdict:\n```json\n{"score": 82, "rationale": "strong"}\n```\nDone.'
    parsed = _extract_json(text)
    assert parsed["score"] == 82


def test_extract_json_no_fence():
    text = 'Verdict: {"score": 60, "rationale": "ok", "risks": ["a"]} end'
    parsed = _extract_json(text)
    assert parsed["score"] == 60


def test_extract_json_garbage_returns_none():
    assert _extract_json("no json here at all") is None


def _vote(persona, dim, score, weight):
    return ExpertVote(persona=persona, dimension=dim, score=score, weight=weight, rationale="x")


def test_aggregate_go_recommendation():
    votes = [_vote(f"p{i}", f"d{i}", 85, 1 / 9) for i in range(9)]
    overall, rec, summary = _aggregate(votes)
    assert rec == "go"
    assert overall >= 75
    assert "GO" in summary


def test_aggregate_no_go_recommendation():
    votes = [_vote(f"p{i}", f"d{i}", 30, 1 / 9) for i in range(9)]
    overall, rec, _ = _aggregate(votes)
    assert rec == "no_go"
    assert overall < 55


def test_aggregate_weighted():
    # one heavy expert scoring low should drag the weighted average
    votes = [_vote("heavy", "fin", 0, 0.9), _vote("light", "ux", 100, 0.1)]
    overall, rec, _ = _aggregate(votes)
    assert overall == pytest.approx(10.0, abs=0.1)
    assert rec == "no_go"


# ─── endpoint with mocked Anthropic ───────────────────────────
@pytest.fixture
def client_with_council(mock_supabase, monkeypatch):  # noqa: ARG001
    """Mock the async Anthropic client so /council/validate runs offline."""
    from src import anthropic_client

    class _Block:
        type = "text"
        text = '```json\n{"score": 78, "rationale": "solid idea", "risks": ["competition"], "opportunities": ["big TAM"]}\n```'

    class _Usage:
        input_tokens = 100
        output_tokens = 50

    class _Msg:
        content = [_Block()]
        usage = _Usage()

    class _Messages:
        async def create(self, **_kw):
            return _Msg()

    class _FakeAnthropic:
        messages = _Messages()

    monkeypatch.setattr(anthropic_client, "get_anthropic", lambda: _FakeAnthropic())
    # council imports get_anthropic at call time via the module, patch there too
    from src.routers import council
    monkeypatch.setattr(council, "get_anthropic", lambda: _FakeAnthropic())

    async def _ok():
        return True
    monkeypatch.setattr(anthropic_client, "anthropic_health", _ok)

    from src.main import app
    return TestClient(app)


def test_council_validate_aggregates_9_votes(client_with_council, signed_jwt):
    res = client_with_council.post(
        "/council/validate",
        headers={"X-Zeniipo-Auth": f"Bearer {signed_jwt}"},
        json={
            "idea": {
                "description": "A SaaS that automates IPO readiness for SEA founders.",
                "industry": "Fintech SaaS",
                "market_size": "TAM $10B SEA",
                "competition": "Carta, Notion — fragmented",
            }
        },
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert len(body["votes"]) == 9
    assert body["overall_score"] == pytest.approx(78.0, abs=0.5)
    assert body["recommendation"] == "go"
    assert all(v["score"] == 78 for v in body["votes"])


def test_council_requires_auth(client_with_council):
    res = client_with_council.post(
        "/council/validate",
        json={"idea": {"description": "x" * 25, "industry": "a", "market_size": "b", "competition": "c"}},
    )
    assert res.status_code == 401
