import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase/server'
import { getCurrentTenantId } from '@/lib/api/tenant'
import { isAnthropicConfigured } from '@/lib/agents/client'
import { runAgent, resolveTenantAgentId } from '@/lib/agents/dispatcher'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// NB: `safeString` caps at 1000 chars — too tight for agent prompts. We use a
// dedicated trimmed string here with a generous 10k limit for prompt bodies.
const InputSchema = z.object({
  prompt: z.string().trim().min(1).max(10_000),
  context: z.record(z.unknown()).optional(),
  mode: z.enum(['fast', 'standard', 'deep']).optional(),
})

const BodySchema = z.object({
  input: InputSchema,
})

/**
 * POST /api/agents/:id/run
 *
 * `:id` is the `agent_code` from `agent_catalog` (e.g. `fin-01-plutus`).
 * We invoke the agent, log to `agent_runs`, and return the output with
 * token + cost telemetry so the caller can surface billing.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  // Service gate — return 503 if API key missing so ops can distinguish
  // "AI disabled" from "auth failed" / "bad request".
  if (!isAnthropicConfigured()) {
    return NextResponse.json(
      { error: 'Service unavailable — AI agents disabled (ANTHROPIC_API_KEY not set)' },
      { status: 503 },
    )
  }

  // agent_code shape: lowercase alphanumeric + hyphen (e.g. `fin-01-plutus`).
  const agentCodeSchema = z
    .string()
    .min(3)
    .max(64)
    .regex(/^[a-z0-9-]+$/, 'agent_code must be lowercase alphanumeric or hyphen')
  const codeCheck = agentCodeSchema.safeParse(params.id)
  if (!codeCheck.success) {
    return NextResponse.json({ error: 'Invalid agent id' }, { status: 400 })
  }
  const agentCode = codeCheck.data

  const body = await req.json().catch(() => ({}))
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const supabase = createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tenantId = await getCurrentTenantId(supabase, user.id)
  if (!tenantId) {
    return NextResponse.json({ error: 'No tenant for user' }, { status: 403 })
  }

  // Resolve tenant-scoped agents.id for the FK on agent_runs.agent_id.
  let tenantAgentId: string
  try {
    tenantAgentId = await resolveTenantAgentId(tenantId, agentCode)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to resolve agent' },
      { status: 404 },
    )
  }

  try {
    const output = await runAgent(agentCode, parsed.data.input)

    // Log success. Failure to log should NOT fail the response, but we await
    // it so cost accounting stays consistent with user experience.
    await supabase.from('agent_runs').insert({
      agent_id: tenantAgentId,
      triggered_by: user.id,
      input: parsed.data.input,
      output: { text: output.text, structured: output.structured ?? null },
      tokens_input: output.tokens.input,
      tokens_output: output.tokens.output,
      cost_usd: output.cost_usd,
      duration_ms: output.duration_ms,
      status: 'success',
    })

    // Touch last_run_at on the tenant agent row.
    await supabase
      .from('agents')
      .update({ last_run_at: new Date().toISOString() })
      .eq('id', tenantAgentId)

    return NextResponse.json({ data: output })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Agent run failed'

    // Log failure row so we can investigate + enforce cost limits later.
    await supabase.from('agent_runs').insert({
      agent_id: tenantAgentId,
      triggered_by: user.id,
      input: parsed.data.input,
      output: null,
      tokens_input: 0,
      tokens_output: 0,
      cost_usd: 0,
      duration_ms: 0,
      status: 'failed',
      error_message: message.slice(0, 500),
    })

    return NextResponse.json({ error: message }, { status: 500 })
  }
}
