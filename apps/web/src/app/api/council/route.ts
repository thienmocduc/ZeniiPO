import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase/server'
import { getCurrentTenantId } from '@/lib/api/tenant'
import { isAnthropicConfigured } from '@/lib/agents/client'
import { runCouncilValidator } from '@/lib/agents/council-validator'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// NB: `safeString` caps at 1000 chars — too tight for business idea bodies.
// We use trimmed strings with explicit limits sized for each field.
const CouncilSchema = z.object({
  description: z.string().trim().min(20).max(10_000),
  industry: z.string().trim().min(2).max(200),
  market_size: z.string().trim().max(2000).optional(),
  competition: z.string().trim().max(2000).optional(),
  team_background: z.string().trim().max(2000).optional(),
})

/**
 * POST /api/council
 *
 * Runs the Council of 9 validator on a business idea and persists the result
 * to `events` as `event_type = 'council_validation'` for audit + replay.
 */
export async function POST(req: Request) {
  if (!isAnthropicConfigured()) {
    return NextResponse.json(
      { error: 'Service unavailable — AI agents disabled (ANTHROPIC_API_KEY not set)' },
      { status: 503 },
    )
  }

  const body = await req.json().catch(() => ({}))
  const parsed = CouncilSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tenantId = await getCurrentTenantId(supabase, user.id)
  if (!tenantId) {
    return NextResponse.json({ error: 'No tenant for user' }, { status: 403 })
  }

  try {
    const result = await runCouncilValidator(parsed.data)

    // Persist for audit trail. `events.payload` is jsonb so we keep the full
    // input + output for replay / cost attribution later.
    await supabase.from('events').insert({
      tenant_id: tenantId,
      actor_id: user.id,
      event_type: 'council_validation',
      payload: {
        input: parsed.data,
        result: {
          overall_score: result.overall_score,
          recommendation: result.recommendation,
          votes: result.votes,
          summary: result.summary,
        },
        meta: result._meta,
      },
      cascade_status: 'completed',
    })

    // Strip internal `_meta` from the public response — keep the type clean.
    const { _meta, ...publicResult } = result
    return NextResponse.json({
      data: publicResult,
      meta: _meta,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Council validation failed'

    // Record failure event for observability.
    await supabase.from('events').insert({
      tenant_id: tenantId,
      actor_id: user.id,
      event_type: 'council_validation',
      payload: { input: parsed.data, error: message.slice(0, 500) },
      cascade_status: 'failed',
    })

    return NextResponse.json({ error: message }, { status: 500 })
  }
}
