/**
 * AI client — DeepSeek (OpenAI-compatible) for the Council of 9 Validator,
 * the 108 Agent Legion, and NLQ.
 *
 * Chairman 2026-06-05: AI runs on DeepSeek (key in env, see feedback_zeniipo_ai_witsagi).
 * DeepSeek exposes an OpenAI-compatible chat-completions endpoint, so we call it
 * with raw fetch — no SDK dependency. If DEEPSEEK_API_KEY is missing, callers
 * surface a 503 "AI disabled" so the UI degrades gracefully.
 */

// Provider-agnostic gateway config. PREFERRED: AI_* → point at the WitsAGI
// gateway (it wraps deepseek-v4-pro + an agent harness for higher intelligence).
// FALLBACK: DEEPSEEK_* (direct) so dev/test works before the WitsAGI key lands.
// Any OpenAI-compatible /chat/completions endpoint works with zero code change —
// just set AI_BASE_URL + AI_API_KEY + AI_MODEL_DEEP/FAST in env.
const apiKey = () => process.env.AI_API_KEY || process.env.DEEPSEEK_API_KEY || ''
const baseUrl = () => process.env.AI_BASE_URL || process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com'

/** Deep reasoning — Council of 9, strategic agents, multi-persona validation. */
export const DEFAULT_MODEL = process.env.AI_MODEL_DEEP || 'deepseek-v4-pro'
/** Fast — NLQ intent parsing, routine single-domain agent calls. */
export const FAST_MODEL = process.env.AI_MODEL_FAST || 'deepseek-v4-flash'

/** True when the AI provider is configured. Routes gate 503 on this. */
export function isAIConfigured(): boolean {
  return Boolean(apiKey())
}
/** @deprecated name kept so existing route gates keep compiling. */
export const isAnthropicConfigured = isAIConfigured

export type ChatResult = { text: string; inputTokens: number; outputTokens: number; model: string }

/**
 * One chat completion against DeepSeek. Returns the assistant text + token
 * usage. Throws (with status) on transport/API error so callers can 5xx.
 */
export async function chatComplete(opts: {
  system?: string
  user: string
  model?: string
  maxTokens?: number
  temperature?: number
}): Promise<ChatResult> {
  const key = apiKey()
  if (!key) throw new Error('AI provider not configured — set AI_API_KEY (WitsAGI gateway) or DEEPSEEK_API_KEY')

  const messages: Array<{ role: 'system' | 'user'; content: string }> = []
  if (opts.system) messages.push({ role: 'system', content: opts.system })
  messages.push({ role: 'user', content: opts.user })

  const res = await fetch(`${baseUrl()}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: opts.model ?? DEFAULT_MODEL,
      messages,
      max_tokens: opts.maxTokens ?? 2048,
      temperature: opts.temperature ?? 0.7,
      stream: false,
    }),
  })
  if (!res.ok) {
    const t = await res.text().catch(() => '')
    throw new Error(`DeepSeek ${res.status}: ${t.slice(0, 300)}`)
  }
  const j = (await res.json()) as {
    model?: string
    choices?: Array<{ message?: { content?: string } }>
    usage?: { prompt_tokens?: number; completion_tokens?: number }
  }
  return {
    text: j.choices?.[0]?.message?.content ?? '',
    inputTokens: j.usage?.prompt_tokens ?? 0,
    outputTokens: j.usage?.completion_tokens ?? 0,
    model: j.model ?? opts.model ?? DEFAULT_MODEL,
  }
}
