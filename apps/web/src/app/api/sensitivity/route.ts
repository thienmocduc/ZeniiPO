import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { requireUserAndTenant } from '@/lib/api/tenant'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Sensitivity table: simple ±10% / ±25% scenarios on revenue × growth.
export async function GET() {
  const supabase = await createServerClient()
  const auth = await requireUserAndTenant(supabase)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status })
  }
  const { data: kpis } = await supabase
    .from('kpi_metrics')
    .select('name, value')
    .eq('tenant_id', auth.tenantId)
    .in('name', ['arr', 'mrr', 'revenue', 'growth_rate', 'gross_margin'])
    .order('captured_at', { ascending: false })
    .limit(20)
  const lookup: Record<string, number> = {}
  for (const k of kpis ?? []) {
    const r = k as { name: string; value: number }
    if (lookup[r.name] == null) lookup[r.name] = Number(r.value)
  }
  const baseRevenue = lookup.arr ?? lookup.mrr ?? lookup.revenue ?? 0
  const baseGrowth = lookup.growth_rate ?? 0
  const baseGM = lookup.gross_margin ?? 0
  const matrix = [-25, -10, 0, 10, 25].map((pctRev) =>
    [-25, -10, 0, 10, 25].map((pctGrowth) => {
      const rev = baseRevenue * (1 + pctRev / 100)
      const growth = baseGrowth * (1 + pctGrowth / 100)
      const projected = rev * (1 + growth / 100)
      return { pctRev, pctGrowth, projected_revenue: projected, gm: baseGM }
    }),
  )
  return NextResponse.json({ data: { base: lookup, matrix } })
}
