import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase/server'
import { requireUserAndTenant } from '@/lib/api/tenant'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// POST — simulate a new funding round's dilution on the latest cap table.
// Pure calc: new investor shares = round / post-money-price; everyone else
// dilutes proportionally. Optionally tops up ESOP to a target % post-round.
const Schema = z.object({
  raise_usd: z.number().positive(),
  pre_money_usd: z.number().positive(),
  esop_topup_to_pct: z.number().min(0).max(30).optional(), // refresh ESOP to this % post-round
})

export async function POST(req: Request) {
  const supabase = await createServerClient()
  const auth = await requireUserAndTenant(supabase)
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status })

  const body = await req.json().catch(() => ({}))
  const parsed = Schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { raise_usd, pre_money_usd, esop_topup_to_pct } = parsed.data

  const { data: snap } = await supabase
    .from('cap_table_snapshots')
    .select('total_shares, holders')
    .eq('tenant_id', auth.tenantId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!snap) return NextResponse.json({ error: 'Chưa có cap table — dựng cap table v0 trước (Khai Tâm).' }, { status: 404 })

  const preShares = Number(snap.total_shares) || 0
  if (preShares <= 0) return NextResponse.json({ error: 'Cap table không hợp lệ' }, { status: 400 })

  const sharePrice = pre_money_usd / preShares
  const newInvestorShares = Math.round(raise_usd / sharePrice)
  let postShares = preShares + newInvestorShares
  const postMoney = pre_money_usd + raise_usd

  // optional ESOP refresh (post-round) — issue shares so ESOP = target%
  let esopTopupShares = 0
  if (esop_topup_to_pct != null && esop_topup_to_pct > 0) {
    // solve: (currentEsop + x) / (postShares + x) = target
    const list = (snap.holders as { list?: { shares: number; type: string }[] })?.list ?? []
    const currentEsop = list.filter((h) => h.type === 'esop').reduce((s, h) => s + (h.shares || 0), 0)
    const target = esop_topup_to_pct / 100
    const x = Math.max(0, Math.round((target * postShares - currentEsop) / (1 - target)))
    esopTopupShares = x
    postShares += x
  }

  const list = (snap.holders as { list?: { name: string; shares: number; type: string }[] })?.list ?? []
  const before = list.map((h) => ({ name: h.name, type: h.type, shares: h.shares, pct: Math.round((h.shares / preShares) * 1000) / 10 }))
  const after = list.map((h) => {
    let shares = h.shares
    if (h.type === 'esop') shares += esopTopupShares
    return { name: h.name, type: h.type, shares, pct: Math.round((shares / postShares) * 1000) / 10 }
  })
  after.push({ name: 'New Round Investors', type: 'investor', shares: newInvestorShares, pct: Math.round((newInvestorShares / postShares) * 1000) / 10 })

  const founderBefore = before.filter((h) => h.type === 'founder').reduce((s, h) => s + h.pct, 0)
  const founderAfter = after.filter((h) => h.type === 'founder').reduce((s, h) => s + h.pct, 0)

  return NextResponse.json({
    data: {
      share_price_usd: Math.round(sharePrice * 10000) / 10000,
      new_investor_shares: newInvestorShares,
      esop_topup_shares: esopTopupShares,
      pre_shares: preShares,
      post_shares: postShares,
      post_money_usd: postMoney,
      investor_pct: Math.round((newInvestorShares / postShares) * 1000) / 10,
      founder_pct_before: Math.round(founderBefore * 10) / 10,
      founder_pct_after: Math.round(founderAfter * 10) / 10,
      founder_dilution_pts: Math.round((founderBefore - founderAfter) * 10) / 10,
      control_warning: founderAfter < 50,
      before,
      after,
    },
  })
}
