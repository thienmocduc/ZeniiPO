import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { isAuthorizedCron } from '@/lib/cron/auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300

/**
 * Daily — recompute readiness_score for every active journey so dashboards
 * show fresh percentages without waiting for the next user-triggered call.
 *
 * The compute_readiness_score RPC is SECURITY DEFINER + tenant-scoped so we
 * call it via the service role and pass each journey id explicitly.
 */
export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const sb = createServiceClient()

  const { data: journeys, error: jErr } = await sb
    .from('ipo_journeys')
    .select('id, tenant_id')
    .eq('status', 'active')
  if (jErr) return NextResponse.json({ error: jErr.message }, { status: 500 })

  const results: Array<{ journey_id: string; tenant_id: string; score?: number; error?: string }> = []
  for (const j of journeys ?? []) {
    const r = await sb.rpc('compute_readiness_score', { p_journey_id: j.id })
    if (r.error) {
      results.push({ journey_id: j.id, tenant_id: j.tenant_id, error: r.error.message })
    } else {
      const total = (r.data as { total_score?: number } | null)?.total_score
      results.push({ journey_id: j.id, tenant_id: j.tenant_id, score: total })
    }
  }

  return NextResponse.json({
    data: {
      processed: results.length,
      ok: results.filter((r) => r.error == null).length,
      errors: results.filter((r) => r.error != null).length,
      results,
    },
  })
}
