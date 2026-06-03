import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase/server'
import { requireUserAndTenant } from '@/lib/api/tenant'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// GET — full 7-level journey state for the current tenant.
export async function GET() {
  const supabase = await createServerClient()
  const auth = await requireUserAndTenant(supabase)
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status })

  // Lazy-init the journey on first read so every tenant has 7 rows.
  const { count } = await supabase
    .from('tenant_level_progress')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', auth.tenantId)
  if ((count ?? 0) === 0) {
    await supabase.rpc('init_tenant_journey', { p_tenant_id: auth.tenantId })
  }

  const { data, error } = await supabase.rpc('get_journey_state', { p_tenant_id: auth.tenantId })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

// POST — advance a level (start_learning | submit_assessment | add_deliverable).
const PostSchema = z.object({
  level_num: z.number().int().min(1).max(7),
  action: z.enum(['start_learning', 'submit_assessment', 'add_deliverable']),
  score: z.number().int().min(0).max(100).optional(),
  deliverable: z.object({ code: z.string(), label: z.string().optional() }).optional(),
})

export async function POST(req: Request) {
  const supabase = await createServerClient()
  const auth = await requireUserAndTenant(supabase)
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status })

  const body = await req.json().catch(() => ({}))
  const parsed = PostSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { data, error } = await supabase.rpc('advance_level', {
    p_tenant_id: auth.tenantId,
    p_level_num: parsed.data.level_num,
    p_action: parsed.data.action,
    p_score: parsed.data.score ?? null,
    p_deliverable: parsed.data.deliverable ?? null,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
