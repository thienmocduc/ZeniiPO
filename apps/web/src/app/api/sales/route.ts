import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { requireUserAndTenant } from '@/lib/api/tenant'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Sales = revenue/MRR/customers KPIs + investor pipeline (treated as "deal pipeline").
export async function GET() {
  const supabase = await createServerClient()
  const auth = await requireUserAndTenant(supabase)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status })
  }
  const [kpis, pipeline] = await Promise.all([
    supabase
      .from('kpi_metrics')
      .select('name, value, unit, captured_at')
      .eq('tenant_id', auth.tenantId)
      .in('name', ['mrr', 'arr', 'new_customers', 'churn_pct', 'revenue', 'aov'])
      .order('captured_at', { ascending: false })
      .limit(120),
    supabase
      .from('investor_pipeline')
      .select('id, investor_name, stage, check_size, status, created_at')
      .order('created_at', { ascending: false })
      .limit(50),
  ])
  if (kpis.error) return NextResponse.json({ error: kpis.error.message }, { status: 500 })
  return NextResponse.json({ data: { kpis: kpis.data ?? [], pipeline: pipeline.data ?? [] } })
}
