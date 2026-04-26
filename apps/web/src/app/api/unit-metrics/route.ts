import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { requireUserAndTenant } from '@/lib/api/tenant'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const UNIT_NAMES = ['cac', 'ltv', 'clv', 'payback_months', 'gross_margin', 'arpu', 'churn_pct', 'nps']

export async function GET() {
  const supabase = await createServerClient()
  const auth = await requireUserAndTenant(supabase)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status })
  }
  const { data, error } = await supabase
    .from('kpi_metrics')
    .select('id, name, value, unit, period, captured_at')
    .eq('tenant_id', auth.tenantId)
    .in('name', UNIT_NAMES)
    .order('captured_at', { ascending: false })
    .limit(120)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const latest: Record<string, unknown> = {}
  for (const row of data ?? []) {
    const r = row as { name: string }
    if (!latest[r.name]) latest[r.name] = row
  }
  return NextResponse.json({ data: { history: data ?? [], latest } })
}
