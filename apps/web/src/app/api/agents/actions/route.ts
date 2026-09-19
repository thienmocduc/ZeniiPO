import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase/server'
import { getCurrentTenantId } from '@/lib/api/tenant'
import { executeAction, sanitizeAction } from '@/lib/agents/action-executor'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET  /api/agents/actions?status=proposed — tenant's agent action queue.
 * PATCH /api/agents/actions { id, decision: 'approve' | 'reject' }
 *   approve → execute immediately (RLS-scoped SSR client) → executed/failed
 *   reject  → status rejected. Both stamp decided_by/decided_at.
 */

export async function GET(req: Request) {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')

  let q = supabase
    .from('agent_actions')
    .select('id, agent_code, action_type, title, payload, confidence, status, created_at, executed_at, error_message')
    .order('created_at', { ascending: false })
    .limit(50)
  if (status) q = q.eq('status', status)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

const PatchSchema = z.object({
  id: z.string().uuid(),
  decision: z.enum(['approve', 'reject']),
})

export async function PATCH(req: Request) {
  const body = await req.json().catch(() => ({}))
  const parsed = PatchSchema.safeParse(body)
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

  // RLS scopes this fetch to the caller's tenant already.
  const { data: action, error: fetchErr } = await supabase
    .from('agent_actions')
    .select('id, tenant_id, agent_code, action_type, title, payload, status')
    .eq('id', parsed.data.id)
    .maybeSingle()
  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 })
  if (!action) return NextResponse.json({ error: 'Action not found' }, { status: 404 })
  if (action.status !== 'proposed') {
    return NextResponse.json({ error: `Action already ${action.status}` }, { status: 409 })
  }

  const now = new Date().toISOString()

  if (parsed.data.decision === 'reject') {
    const { data, error } = await supabase
      .from('agent_actions')
      .update({ status: 'rejected', decided_by: user.id, decided_at: now })
      .eq('id', action.id)
      .select('id, status')
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data })
  }

  // approve → re-validate payload (defense in depth) → execute.
  const proposal = sanitizeAction({
    type: action.action_type,
    title: action.title,
    payload: action.payload,
  })
  if (!proposal) {
    await supabase
      .from('agent_actions')
      .update({
        status: 'failed',
        decided_by: user.id,
        decided_at: now,
        error_message: 'payload failed validation at approval time',
      })
      .eq('id', action.id)
    return NextResponse.json({ error: 'Payload failed validation' }, { status: 422 })
  }

  const res = await executeAction(supabase, action.tenant_id as string, action.agent_code as string, proposal)
  const { data, error } = await supabase
    .from('agent_actions')
    .update({
      status: res.ok ? 'executed' : 'failed',
      decided_by: user.id,
      decided_at: now,
      executed_at: now,
      result: res.result ?? null,
      error_message: res.error ?? null,
    })
    .eq('id', action.id)
    .select('id, status, result, error_message')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
