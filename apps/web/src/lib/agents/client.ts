import Anthropic from '@anthropic-ai/sdk'

/**
 * Anthropic client singleton for the 108 Agent Legion + Council of 9 Validator.
 *
 * Reads ANTHROPIC_API_KEY from env at first call. Throws a clear error if missing
 * so API routes can return 503 "Service unavailable" with an actionable message.
 */
let cachedClient: Anthropic | null = null

export function getAnthropicClient(): Anthropic {
  if (cachedClient) return cachedClient

  const key = process.env.ANTHROPIC_API_KEY
  if (!key) {
    throw new Error('ANTHROPIC_API_KEY missing — set in env to enable AI agents')
  }

  cachedClient = new Anthropic({ apiKey: key })
  return cachedClient
}

/**
 * Default model for deep reasoning — Council of 9, strategic agents,
 * multi-persona validation. Slower + higher cost but better judgment.
 */
export const DEFAULT_MODEL = 'claude-opus-4-5' as const

/**
 * Fast model for routine agent calls — single-domain lookups, quick summaries,
 * high-volume dispatches. Input/output ~15x cheaper than Opus.
 */
export const FAST_MODEL = 'claude-haiku-4-5-20251001' as const

/**
 * Returns true when the Anthropic API is configured. Use in API routes to
 * gate 503 responses before invoking agent logic.
 */
export function isAnthropicConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY)
}
