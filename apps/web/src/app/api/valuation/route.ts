import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { requireUserAndTenant } from '@/lib/api/tenant'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  const supabase = await createServerClient()
  const auth = await requireUserAndTenant(supabase)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status })
  }
  const [journey, snapshots, comps] = await Promise.all([
    supabase
      .from('ipo_journeys')
      .select('id, name, valuation_target, current_phase, target_year, exit_venue')
      .eq('tenant_id', auth.tenantId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('cap_table_snapshots')
      .select('id, snapshot_date, snapshot_type, total_shares, fully_diluted_shares, valuation_usd, share_price_usd, holders')
      .eq('tenant_id', auth.tenantId)
      .order('snapshot_date', { ascending: false })
      .limit(20),
    supabase
      .from('comparables')
      .select('company_name, ticker, ev_revenue_multiple, ev_ebitda_multiple, pe_ratio, growth_rate_pct')
      .eq('tenant_id', auth.tenantId)
      .order('updated_at', { ascending: false })
      .limit(20),
  ])
  return NextResponse.json({
    data: {
      journey: journey.data,
      cap_history: snapshots.data ?? [],
      comparables: comps.data ?? [],
    },
  })
}
