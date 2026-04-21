import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase/server'
import { getCurrentTenantId } from '@/lib/api/tenant'
import { safeUuid } from '@/lib/security/schemas'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const ComputeSchema = z.object({
  round_id: safeUuid,
})

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const parsed = ComputeSchema.safeParse(body)
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

  // Load round
  const { data: round, error: rErr } = await supabase
    .from('fundraise_rounds')
    .select('*')
    .eq('id', parsed.data.round_id)
    .maybeSingle()

  if (rErr) return NextResponse.json({ error: rErr.message }, { status: 500 })
  if (!round) return NextResponse.json({ error: 'Round not found' }, { status: 404 })

  // Load latest prior snapshot
  const { data: prior } = await supabase
    .from('cap_table_snapshots')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  // Compute dilution: new_money_pct = target_amount / (pre_money + target_amount)
  const preMoney = Number(round.pre_money_valuation ?? 0)
  const raise = Number(round.target_amount ?? 0)
  const postMoney = preMoney + raise
  const newMoneyPct = postMoney > 0 ? raise / postMoney : 0
  const retainedPct = 1 - newMoneyPct

  const priorHoldings =
    (prior?.holdings as Array<{ holder: string; pct: number }> | null) ?? []
  const dilutedHoldings = priorHoldings.map((h) => ({
    holder: h.holder,
    pct: Number((h.pct * retainedPct).toFixed(6)),
  }))
  dilutedHoldings.push({ holder: `Round: ${round.name}`, pct: Number(newMoneyPct.toFixed(6)) })

  const { data, error } = await supabase
    .from('cap_table_snapshots')
    .insert({
      tenant_id: tenantId,
      round_id: round.id,
      pre_money_valuation: preMoney,
      post_money_valuation: postMoney,
      holdings: dilutedHoldings,
      created_by: user.id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}
