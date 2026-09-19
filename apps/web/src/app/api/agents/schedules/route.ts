import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase/server'
import { getCurrentTenantId } from '@/lib/api/tenant'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET  /api/agents/schedules — tenant's autonomous agent roster.
 * POST /api/agents/schedules { agent_code, cadence?, autonomy?, enabled? }
 *   Upserts on (tenant_id, agent_code). Enabling resets next_run_at → now
 *   so the next cron tick picks the agent up immediately.
 */

export async function GET() {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('agent_schedules')
    .select('id, agent_code, cadence, autonomy, enabled, next_run_at, last_run_at')
    .order('agent_code', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  // Embed agent_catalog thủ công (compat client không hỗ trợ join PostgREST)
  const rows = (data ?? []) as Array<Record<string, unknown>>
  const codes = [...new Set(rows.map((s) => String(s.agent_code)))]
  let catalogByCode: Record<string, unknown> = {}
  if (codes.length > 0) {
    const { data: cats } = await supabase
      .from('agent_catalog')
      .select('agent_code, name, department, is_chief')
      .in('agent_code', codes)
    catalogByCode = Object.fromEntries(
      ((cats ?? []) as Array<Record<string, unknown>>).map((c) => [
        String(c.agent_code),
        { name: c.name, department: c.department, is_chief: c.is_chief },
      ]),
    )
  }
  const merged = rows.map((s) => ({
    ...s,
    agent_catalog: catalogByCode[String(s.agent_code)] ?? null,
  }))
  return NextResponse.json({ data: merged })
}

const PostSchema = z.object({
  agent_code: z
    .string()
    .min(3)
    .max(64)
    .regex(/^[a-z0-9-]+$/),
  cadence: z.enum(['daily', 'weekly', 'monthly']).optional(),
  autonomy: z.enum(['propose', 'auto']).optional(),
  enabled: z.boolean().optional(),
})

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const parsed = PostSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tenantId = await getCurrentTenantId(supabase, user.id)
  if (!tenantId) return NextResponse.json({ error: 'No tenant for user' }, { status: 403 })

  const { agent_code, cadence, autonomy, enabled } = parsed.data
  const patch: Record<string, unknown> = {
    tenant_id: tenantId,
    agent_code,
  }
  if (cadence) patch.cadence = cadence
  if (autonomy) patch.autonomy = autonomy
  if (typeof enabled === 'boolean') {
    patch.enabled = enabled
    if (enabled) patch.next_run_at = new Date().toISOString()
  }

  const { data, error } = await supabase
    .from('agent_schedules')
    .upsert(patch, { onConflict: 'tenant_id,agent_code' })
    .select('id, agent_code, cadence, autonomy, enabled, next_run_at')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}
