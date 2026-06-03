import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Admin overview — chairman_super only.
export async function GET() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: isSuper } = await supabase.rpc('is_chairman_super')
  if (!isSuper) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const [tenants, users, journeys, events] = await Promise.all([
    supabase.from('tenants').select('id, name, slug, plan, created_at').order('created_at', { ascending: false }),
    supabase.from('user_profiles').select('id, email, role, tenant_id, created_at, last_active_at').order('created_at', { ascending: false }).limit(200),
    supabase.from('ipo_journeys').select('id, name, current_phase, valuation_target, tenant_id, created_at').order('created_at', { ascending: false }).limit(50),
    supabase.from('events').select('id, event_type, payload, created_at').order('created_at', { ascending: false }).limit(50),
  ])

  return NextResponse.json({
    data: {
      tenants: tenants.data ?? [],
      users: users.data ?? [],
      journeys: journeys.data ?? [],
      recent_events: events.data ?? [],
      counts: {
        tenants: tenants.data?.length ?? 0,
        users: users.data?.length ?? 0,
        journeys: journeys.data?.length ?? 0,
      },
    },
  })
}
