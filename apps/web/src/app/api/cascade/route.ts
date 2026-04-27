import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase/server'
import { getCurrentTenantId } from '@/lib/api/tenant'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const VENUES = ['SGX', 'NASDAQ', 'NYSE', 'HKEX', 'HOSE'] as const

const CascadeSchema = z.object({
  valuation: z.number().positive().finite(),
  venue: z.enum(VENUES),
  year: z.number().int().min(2026).max(2040),
  industry: z.string().trim().min(1).max(100),
  north_star: z.string().trim().max(200).optional(),
  strategy: z.string().trim().min(1).max(5000),
})

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const parsed = CascadeSchema.safeParse(body)
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

  // RPC signature: cascade_chairman_event(p_tenant_id, p_valuation, p_venue,
  //   p_year, p_industry, p_strategy). p_venue must match
  //   ipo_journeys.exit_venue check (sgx | nasdaq | nyse | hkex | hose) — lowercase.
  const { data, error } = await supabase.rpc('cascade_chairman_event', {
    p_tenant_id: tenantId,
    p_valuation: parsed.data.valuation,
    p_venue: parsed.data.venue.toLowerCase(),
    p_year: parsed.data.year,
    p_industry: parsed.data.industry,
    p_strategy: parsed.data.strategy,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // RPC may return a single row or an array — normalize either shape.
  const row = Array.isArray(data) ? data[0] : data
  return NextResponse.json({
    data: {
      event_id: row?.event_id ?? null,
      journey_id: row?.journey_id ?? null,
      objectives_count: 4,
    },
  })
}
