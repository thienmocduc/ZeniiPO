import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase/server'
import { getCurrentTenantId } from '@/lib/api/tenant'
import { safeString } from '@/lib/security/sanitize'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const CascadeSchema = z.object({
  valuation: z.number().positive(),
  venue: safeString.min(1),
  year: z.number().int().min(2024).max(2100),
  industry: safeString.min(1),
  strategy: safeString.min(1),
})

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const parsed = CascadeSchema.safeParse(body)
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

  const { data, error } = await supabase.rpc('cascade_chairman_event', {
    tenant_id: tenantId,
    valuation: parsed.data.valuation,
    venue: parsed.data.venue,
    year: parsed.data.year,
    industry: parsed.data.industry,
    strategy: parsed.data.strategy,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // RPC may return a single row or { event_id, journey_id } — normalize
  const row = Array.isArray(data) ? data[0] : data
  return NextResponse.json({
    data: {
      event_id: row?.event_id ?? null,
      journey_id: row?.journey_id ?? null,
    },
  })
}
