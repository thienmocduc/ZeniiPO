import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase/server'
import { requireUserAndTenant } from '@/lib/api/tenant'
import { safeString } from '@/lib/security/schemas'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// POST — create a cap-table snapshot (used by Khai Tâm onboarding + cap-table page).
// Computes founder/esop/investor % from holders so downstream gates can read them.
const HolderSchema = z.object({
  name: safeString.min(1).max(120),
  shares: z.number().int().positive(),
  type: z.enum(['founder', 'esop', 'investor', 'advisor']).default('founder'),
})
// snapshot_type is DB-constrained to pre_round|post_round|monthly|yearly|adhoc.
// Khai Tâm v0 is an initial ad-hoc snapshot; we tag origin inside holders json.
const PostSchema = z.object({
  holders: z.array(HolderSchema).min(1).max(100),
  snapshot_type: z.enum(['pre_round', 'post_round', 'monthly', 'yearly', 'adhoc']).default('adhoc'),
  origin: safeString.max(40).optional(),
  valuation_usd: z.number().nonnegative().optional(),
})

export async function POST(req: Request) {
  const supabase = await createServerClient()
  const auth = await requireUserAndTenant(supabase)
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status })

  const body = await req.json().catch(() => ({}))
  const parsed = PostSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const holders = parsed.data.holders
  const totalShares = holders.reduce((s, h) => s + h.shares, 0)
  const pctByType = (t: string) =>
    Math.round((holders.filter((h) => h.type === t).reduce((s, h) => s + h.shares, 0) / totalShares) * 1000) / 10

  // cap_table_snapshots.journey_id is NOT NULL → resolve or create a journey.
  let journeyId: string | null = null
  const { data: j } = await supabase
    .from('ipo_journeys')
    .select('id')
    .eq('tenant_id', auth.tenantId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  journeyId = j?.id ?? null
  if (!journeyId) {
    const { data: nj, error: njErr } = await supabase
      .from('ipo_journeys')
      .insert({ tenant_id: auth.tenantId, name: 'IPO Journey', current_phase: 1, exit_venue: 'sgx', target_year: 2031 })
      .select('id')
      .single()
    if (njErr) return NextResponse.json({ error: `journey: ${njErr.message}` }, { status: 500 })
    journeyId = nj.id
  }

  const enriched = holders.map((h) => ({ ...h, pct: Math.round((h.shares / totalShares) * 1000) / 10 }))
  const { data, error } = await supabase
    .from('cap_table_snapshots')
    .insert({
      tenant_id: auth.tenantId,
      journey_id: journeyId,
      snapshot_date: new Date().toISOString().slice(0, 10),
      snapshot_type: parsed.data.snapshot_type,
      holders: { list: enriched, origin: parsed.data.origin ?? 'cap_table', founder_pct: pctByType('founder'), esop_pct: pctByType('esop'), investor_pct: pctByType('investor') },
      total_shares: totalShares,
      fully_diluted_shares: totalShares,
      valuation_usd: parsed.data.valuation_usd ?? null,
    })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data, summary: { total_shares: totalShares, founder_pct: pctByType('founder'), esop_pct: pctByType('esop') } }, { status: 201 })
}

export async function GET(req: Request) {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const mode = searchParams.get('mode') ?? 'latest' // 'latest' | 'series'

  if (mode === 'series') {
    const { data, error } = await supabase
      .from('cap_table_snapshots')
      .select('*')
      .order('created_at', { ascending: true })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data })
  }

  const { data, error } = await supabase
    .from('cap_table_snapshots')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
