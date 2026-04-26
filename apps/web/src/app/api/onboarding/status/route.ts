import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { requireUserAndTenant } from '@/lib/api/tenant'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Returns whether the current tenant has completed the onboarding wizard
// (= has at least one IPO journey). Used by middleware + /onboarding page.
export async function GET() {
  const supabase = await createServerClient()
  const auth = await requireUserAndTenant(supabase)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status })
  }
  const { count } = await supabase
    .from('ipo_journeys')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', auth.tenantId)
  return NextResponse.json({ data: { onboarded: (count ?? 0) > 0, journey_count: count ?? 0 } })
}
