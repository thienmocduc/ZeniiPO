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
  const [tiers, sub] = await Promise.all([
    supabase.from('membership_tiers').select('*').order('price_usd_month', { ascending: true }),
    supabase
      .from('subscriptions')
      .select('*')
      .eq('tenant_id', auth.tenantId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])
  if (tiers.error) return NextResponse.json({ error: tiers.error.message }, { status: 500 })
  return NextResponse.json({
    data: {
      tiers: tiers.data ?? [],
      current_subscription: sub.data,
    },
  })
}
