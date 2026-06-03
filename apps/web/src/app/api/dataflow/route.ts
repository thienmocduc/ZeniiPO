import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { requireUserAndTenant } from '@/lib/api/tenant'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Data flow = recent events stream + edge fn / RPC trigger map.
export async function GET(req: Request) {
  const supabase = await createServerClient()
  const auth = await requireUserAndTenant(supabase)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status })
  }
  const url = new URL(req.url)
  const limit = Math.min(500, Number(url.searchParams.get('limit') ?? 100))
  const { data: events, error } = await supabase
    .from('events')
    .select('id, event_type, payload, created_at')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Group by event_type for pipeline summary.
  const byType: Record<string, number> = {}
  for (const ev of events ?? []) {
    const t = (ev as { event_type: string }).event_type
    byType[t] = (byType[t] ?? 0) + 1
  }
  return NextResponse.json({ data: { events: events ?? [], by_type: byType } })
}
