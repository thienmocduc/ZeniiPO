import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { requireUserAndTenant } from '@/lib/api/tenant'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Workflow = phase gate state for current journey.
export async function GET() {
  const supabase = await createServerClient()
  const auth = await requireUserAndTenant(supabase)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status })
  }
  const { data: journey } = await supabase
    .from('ipo_journeys')
    .select('id, current_phase, target_year, valuation_target, status, name')
    .eq('tenant_id', auth.tenantId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!journey) return NextResponse.json({ data: { journey: null, gates: [] } })

  const { data: gates, error } = await supabase
    .from('phase_gates')
    .select('id, phase_num, gate_code, criterion_name_vi, criterion_category, status, current_value, target_value, pass_score')
    .eq('journey_id', journey.id)
    .order('phase_num', { ascending: true })
    .order('gate_code', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data: { journey, gates: gates ?? [] } })
}
