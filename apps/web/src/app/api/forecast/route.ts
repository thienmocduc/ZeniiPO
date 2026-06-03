import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { requireUserAndTenant } from '@/lib/api/tenant'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Forecast = revenue/burn KPIs trajectory + simple linear projection 6 months.
export async function GET() {
  const supabase = await createServerClient()
  const auth = await requireUserAndTenant(supabase)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status })
  }
  const names = ['mrr', 'arr', 'revenue', 'monthly_burn', 'cash_balance']
  const { data, error } = await supabase
    .from('kpi_metrics')
    .select('name, value, captured_at')
    .eq('tenant_id', auth.tenantId)
    .in('name', names)
    .order('captured_at', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const series: Record<string, { period: string; value: number }[]> = {}
  for (const row of data ?? []) {
    const r = row as { name: string; value: number; captured_at: string }
    ;(series[r.name] ??= []).push({ period: r.captured_at, value: Number(r.value) })
  }
  // Simple linear projection: last 3 → next 6 (slope avg).
  const projection: Record<string, { period: string; value: number }[]> = {}
  for (const [name, points] of Object.entries(series)) {
    if (points.length < 2) continue
    const last3 = points.slice(-3)
    const slope = (last3[last3.length - 1].value - last3[0].value) / Math.max(1, last3.length - 1)
    const lastPeriod = new Date(last3[last3.length - 1].period)
    const proj: { period: string; value: number }[] = []
    for (let i = 1; i <= 6; i++) {
      const d = new Date(lastPeriod)
      d.setMonth(d.getMonth() + i)
      proj.push({
        period: d.toISOString().slice(0, 10),
        value: last3[last3.length - 1].value + slope * i,
      })
    }
    projection[name] = proj
  }
  return NextResponse.json({ data: { series, projection } })
}
