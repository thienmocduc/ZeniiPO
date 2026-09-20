import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET /api/agents — one-call payload for the Agent Command Center page:
 *   catalog (108), configured (tenant roster), engine state (schedules,
 *   pending actions, recent runs). Engine tables ship in migration 024 —
 *   until it applies those sections degrade to [] instead of failing the
 *   whole page (tolerateErr).
 */

type Rows = Array<Record<string, unknown>>
const tolerateErr = (r: { data: unknown; error: unknown }): Rows =>
  r.error || !Array.isArray(r.data) ? [] : (r.data as Rows)

export async function GET() {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [configured, catalog, schedules, pendingActions, recentActions, recentRuns] =
    await Promise.all([
      supabase.from('agents').select('*').order('name', { ascending: false }),
      supabase.from('agent_catalog').select('*').order('display_order', { ascending: true }),
      supabase
        .from('agent_schedules')
        .select('id, agent_code, cadence, autonomy, enabled, next_run_at, last_run_at')
        .order('agent_code'),
      supabase
        .from('agent_actions')
        .select('id, agent_code, action_type, title, payload, confidence, status, created_at')
        .eq('status', 'proposed')
        .order('created_at', { ascending: false })
        .limit(20),
      supabase
        .from('agent_actions')
        .select('id, agent_code, action_type, title, status, created_at, executed_at')
        .neq('status', 'proposed')
        .order('created_at', { ascending: false })
        .limit(10),
      supabase
        .from('agent_runs')
        .select('id, agent_id, status, cost_usd, created_at')
        .order('created_at', { ascending: false })
        .limit(10),
    ])

  // Catalog is the backbone — hard-fail only on it.
  if (catalog.error) {
    return NextResponse.json({ error: catalog.error.message }, { status: 500 })
  }

  // Embed agents thủ công (compat client không hỗ trợ join PostgREST !inner).
  const runRows = (tolerateErr(recentRuns) ?? []) as Array<Record<string, unknown>>
  let runsWithAgents: Array<Record<string, unknown>> = []
  if (runRows.length > 0) {
    const agentIds = [...new Set(runRows.map((r) => String(r.agent_id)))]
    const { data: agentRows } = await supabase
      .from('agents')
      .select('id, agent_code, name, tenant_id')
      .in('id', agentIds)
    const byId = new Map(
      ((agentRows ?? []) as Array<Record<string, unknown>>).map((a) => [String(a.id), a]),
    )
    runsWithAgents = runRows
      .filter((r) => byId.has(String(r.agent_id))) // giữ ngữ nghĩa !inner
      .map((r) => ({ ...r, agents: byId.get(String(r.agent_id)) }))
  }

  return NextResponse.json({
    data: {
      configured: tolerateErr(configured),
      catalog: catalog.data,
      engine: {
        schedules: tolerateErr(schedules),
        actions_pending: tolerateErr(pendingActions),
        actions_recent: tolerateErr(recentActions),
        runs_recent: runsWithAgents,
      },
    },
  })
}
