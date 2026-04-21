import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { getCurrentTenantId } from '@/lib/api/tenant'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  const supabase = createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tenantId = await getCurrentTenantId(supabase, user.id)
  if (!tenantId) {
    return NextResponse.json({ error: 'No tenant for user' }, { status: 403 })
  }

  const [profile, tenant, journey, kpis, tasks, events] = await Promise.all([
    supabase.from('user_profiles').select('*').eq('user_id', user.id).maybeSingle(),
    supabase.from('tenants').select('*').eq('id', tenantId).maybeSingle(),
    supabase
      .from('ipo_journeys')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('kpi_metrics')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(4),
    supabase
      .from('tasks')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5),
    supabase
      .from('events')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5),
  ])

  // Readiness score via RPC (requires journey)
  let readiness: unknown = null
  if (journey.data?.id) {
    const { data } = await supabase.rpc('compute_readiness_score', {
      journey_id: journey.data.id,
    })
    readiness = data
  }

  return NextResponse.json({
    data: {
      user: { id: user.id, email: user.email },
      profile: profile.data,
      tenant: tenant.data,
      journey: journey.data,
      kpis: kpis.data ?? [],
      tasks: tasks.data ?? [],
      events: events.data ?? [],
      readiness,
    },
  })
}
