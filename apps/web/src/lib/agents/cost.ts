/**
 * Cost calculator for Anthropic API usage.
 *
 * Pricing reference (Jan 2026 public rates, USD per 1M tokens):
 *   claude-opus-4-5       — input $15    · output $75
 *   claude-opus-4-7       — input $15    · output $75   (same tier as 4-5)
 *   claude-haiku-4-5      — input $1     · output $5
 *   claude-sonnet-4-5     — input $3     · output $15   (mid-tier, kept for future use)
 *
 * TODO Q2/2026: wire in prompt caching discounts (cache_control directives give
 * up to 10x read savings + 25% write premium). See client.ts + dispatcher.ts.
 */

type Pricing = { input: number; output: number } // USD per 1M tokens

const PRICING: Record<string, Pricing> = {
  'claude-opus-4-5': { input: 15, output: 75 },
  'claude-opus-4-7': { input: 15, output: 75 },
  'claude-haiku-4-5-20251001': { input: 1, output: 5 },
  'claude-haiku-4-5': { input: 1, output: 5 },
  'claude-sonnet-4-5': { input: 3, output: 15 },
}

const DEFAULT_PRICING: Pricing = PRICING['claude-opus-4-5']

function resolvePricing(model: string): Pricing {
  if (PRICING[model]) return PRICING[model]
  // Fallback: match by family prefix so new model snapshots (e.g.
  // `claude-opus-4-5-20260115`) still map to the right tier.
  if (model.startsWith('claude-opus-')) return { input: 15, output: 75 }
  if (model.startsWith('claude-sonnet-')) return { input: 3, output: 15 }
  if (model.startsWith('claude-haiku-')) return { input: 1, output: 5 }
  return DEFAULT_PRICING
}

/**
 * Returns cost in USD for a given token count + model.
 * Rounded to 6 decimal places (1e-6 USD = micro-dollar) for DB storage.
 */
export function computeCost(
  tokens: { input: number; output: number },
  model: string,
): number {
  const price = resolvePricing(model)
  const inputCost = (tokens.input / 1_000_000) * price.input
  const outputCost = (tokens.output / 1_000_000) * price.output
  const total = inputCost + outputCost
  return Math.round(total * 1_000_000) / 1_000_000
}
