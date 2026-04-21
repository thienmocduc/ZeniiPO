import { DEFAULT_MODEL, getAnthropicClient } from './client'
import { computeCost } from './cost'
import type { CouncilResult, CouncilVote } from './types'

/**
 * Council of 9 — business idea validator.
 *
 * Sends a single Claude message containing nine distinct expert personas.
 * The model role-plays each expert, scores the idea 0-100 on their dimension,
 * casts a green/amber/red vote with reasoning, and rolls up to an overall
 * recommendation.
 *
 * Why one call instead of nine parallel calls:
 *   - One shared context → no repeated idea framing (cheaper).
 *   - Experts can reference each other ("as the Regulatory expert noted…")
 *     which mimics real council dynamics.
 *   - Atomic output: no partial failures mid-council.
 *
 * TODO Q2/2026: add `cache_control` on the system prompt for 90% discount on
 *   the static expert definitions across repeated validations.
 */

const COUNCIL_SYSTEM_PROMPT = `You are the Council of 9, a panel of nine senior experts who evaluate business ideas for go / revise / no_go recommendations. You role-play all nine members in a single response.

THE NINE EXPERTS
1. Market Analyst — Market size, growth, timing, customer demand signals.
2. Technical Feasibility — Engineering complexity, tech readiness, build risk.
3. Financial Modeler — Revenue model, pricing, gross margin, cap table implications.
4. Unit Economics — CAC, LTV, payback period, contribution margin at scale.
5. Regulatory — Licensing, compliance burden, jurisdiction risk, data / privacy.
6. Distribution — Go-to-market channels, sales motion, partnerships.
7. Capital Efficiency — Burn rate, runway, capital needed to reach milestones.
8. Founder Clarity — Problem framing, strategic focus, team-market fit.
9. Moat & Defensibility — Competitive advantage, IP, network effects, switching cost.

VOTING RULES
- Each expert scores their dimension 0-100 (0 = fatal, 100 = exceptional).
- Each expert casts a vote:
    "green"  — strong signal in their dimension (score >= 70)
    "amber"  — mixed / conditional (score 40-69)
    "red"    — blocker in their dimension (score < 40)
- Reasoning is 1-3 sentences, specific to the idea given (no boilerplate).

AGGREGATION
- overall_score = arithmetic mean of the nine scores, rounded to integer.
- recommendation:
    "go"     — overall_score >= 70 AND zero red votes
    "revise" — overall_score 50-69, OR overall_score >= 70 with 1-2 red votes
    "no_go"  — overall_score < 50, OR 3+ red votes regardless of score
- summary = 2-4 sentence synthesis citing the strongest green and most critical red.

OUTPUT FORMAT — CRITICAL
Return ONLY valid JSON. No prose, no markdown fences, no preamble. The JSON must match exactly this schema:

{
  "overall_score": <integer 0-100>,
  "recommendation": "go" | "revise" | "no_go",
  "votes": [
    { "agent": "Market Analyst",        "vote": "green"|"amber"|"red", "score": <0-100>, "reasoning": "..." },
    { "agent": "Technical Feasibility", "vote": "green"|"amber"|"red", "score": <0-100>, "reasoning": "..." },
    { "agent": "Financial Modeler",     "vote": "green"|"amber"|"red", "score": <0-100>, "reasoning": "..." },
    { "agent": "Unit Economics",        "vote": "green"|"amber"|"red", "score": <0-100>, "reasoning": "..." },
    { "agent": "Regulatory",            "vote": "green"|"amber"|"red", "score": <0-100>, "reasoning": "..." },
    { "agent": "Distribution",          "vote": "green"|"amber"|"red", "score": <0-100>, "reasoning": "..." },
    { "agent": "Capital Efficiency",    "vote": "green"|"amber"|"red", "score": <0-100>, "reasoning": "..." },
    { "agent": "Founder Clarity",       "vote": "green"|"amber"|"red", "score": <0-100>, "reasoning": "..." },
    { "agent": "Moat & Defensibility",  "vote": "green"|"amber"|"red", "score": <0-100>, "reasoning": "..." }
  ],
  "summary": "..."
}

Do NOT wrap the JSON in code fences. Do NOT add comments. Output MUST parse with JSON.parse on the first try.`

export type CouncilIdea = {
  description: string
  industry: string
  market_size?: string
  competition?: string
  team_background?: string
}

function buildUserPrompt(idea: CouncilIdea): string {
  const parts = [
    `IDEA DESCRIPTION\n${idea.description.trim()}`,
    `INDUSTRY\n${idea.industry.trim()}`,
  ]
  if (idea.market_size) parts.push(`MARKET SIZE\n${idea.market_size.trim()}`)
  if (idea.competition) parts.push(`COMPETITION\n${idea.competition.trim()}`)
  if (idea.team_background)
    parts.push(`TEAM BACKGROUND\n${idea.team_background.trim()}`)
  parts.push('Evaluate this idea using the nine-expert council. Return only JSON.')
  return parts.join('\n\n')
}

/**
 * Extracts a JSON object from model output. The system prompt instructs the
 * model to return raw JSON, but models occasionally wrap it in fences or add
 * trailing whitespace — handle both gracefully.
 */
function extractJson(text: string): string {
  const trimmed = text.trim()

  // Strip ```json ... ``` or ``` ... ``` fences if present.
  const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/)
  if (fenceMatch) return fenceMatch[1].trim()

  // Fallback: find first `{` to last `}` — covers trailing prose.
  const first = trimmed.indexOf('{')
  const last = trimmed.lastIndexOf('}')
  if (first !== -1 && last !== -1 && last > first) {
    return trimmed.slice(first, last + 1)
  }

  return trimmed
}

function isCouncilResult(value: unknown): value is CouncilResult {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return (
    typeof v.overall_score === 'number' &&
    typeof v.recommendation === 'string' &&
    Array.isArray(v.votes) &&
    typeof v.summary === 'string' &&
    (v.votes as unknown[]).every((vote) => {
      if (!vote || typeof vote !== 'object') return false
      const x = vote as Record<string, unknown>
      return (
        typeof x.agent === 'string' &&
        typeof x.vote === 'string' &&
        typeof x.score === 'number' &&
        typeof x.reasoning === 'string'
      )
    })
  )
}

async function callCouncil(
  idea: CouncilIdea,
): Promise<{ raw: string; inputTokens: number; outputTokens: number }> {
  const client = getAnthropicClient()
  const userPrompt = buildUserPrompt(idea)

  const message = await client.messages.create({
    model: DEFAULT_MODEL,
    max_tokens: 2048,
    system: COUNCIL_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userPrompt }],
  })

  // Concatenate all text blocks (usually one, but guard against future shapes).
  const raw = message.content
    .filter((block): block is { type: 'text'; text: string } => block.type === 'text')
    .map((block) => block.text)
    .join('')

  return {
    raw,
    inputTokens: message.usage?.input_tokens ?? 0,
    outputTokens: message.usage?.output_tokens ?? 0,
  }
}

/**
 * Run the Council of 9 validator against a business idea.
 * Retries once on JSON parse failure. Throws on second failure.
 */
export async function runCouncilValidator(
  idea: CouncilIdea,
): Promise<CouncilResult & { _meta: { tokens: { input: number; output: number }; cost_usd: number; duration_ms: number } }> {
  const started = Date.now()

  let totalInput = 0
  let totalOutput = 0
  let lastRaw = ''
  let parseError: unknown = null

  for (let attempt = 0; attempt < 2; attempt++) {
    const { raw, inputTokens, outputTokens } = await callCouncil(idea)
    totalInput += inputTokens
    totalOutput += outputTokens
    lastRaw = raw

    try {
      const json = extractJson(raw)
      const parsed = JSON.parse(json)
      if (!isCouncilResult(parsed)) {
        throw new Error('Council response did not match schema')
      }
      const cost = computeCost(
        { input: totalInput, output: totalOutput },
        DEFAULT_MODEL,
      )
      return {
        ...parsed,
        _meta: {
          tokens: { input: totalInput, output: totalOutput },
          cost_usd: cost,
          duration_ms: Date.now() - started,
        },
      }
    } catch (err) {
      parseError = err
      // Retry once — sometimes the model adds prose on the first try.
    }
  }

  throw new Error(
    `Council validator failed to return valid JSON after 2 attempts. Last error: ${String(
      parseError,
    )}. Raw: ${lastRaw.slice(0, 500)}`,
  )
}
