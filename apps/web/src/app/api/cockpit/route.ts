import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { requireUserAndTenant } from '@/lib/api/tenant'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Command Cockpit — the single source-of-truth view (spec tenet #1).
 * Aggregates every pillar into one envelope so the Chairman sees exactly
 * where the company is on the 0→IPO journey, in one read.
 */
export async function GET() {
  const supabase = await createServerClient()
  const auth = await requireUserAndTenant(supabase)
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status })
  const tid = auth.tenantId

  // Lazy-init journey so the cockpit always has the 7-level state.
  const { count: jlpCount } = await supabase
    .from('tenant_level_progress')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tid)
  if ((jlpCount ?? 0) === 0) await supabase.rpc('init_tenant_journey', { p_tenant_id: tid })

  const [profile, tenant, journeyState, journey, readiness, finModel, capTable, certs, tasks, kpis, events] =
    await Promise.all([
      supabase.from('user_profiles').select('full_name, role').eq('id', auth.user.id).maybeSingle(),
      supabase.from('tenants').select('name, slug, plan').eq('id', tid).maybeSingle(),
      supabase.rpc('get_journey_state', { p_tenant_id: tid }),
      supabase.from('ipo_journeys').select('id, name, current_phase, valuation_target, exit_venue, target_year, industry, north_star_metric')
        .eq('tenant_id', tid).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('readiness_score_history').select('total_score, breakdown_by_category, created_at')
        .eq('tenant_id', tid).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('financial_models').select('result, assumptions, created_at')
        .eq('tenant_id', tid).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('cap_table_snapshots').select('total_shares, holders, valuation_usd, created_at')
        .eq('tenant_id', tid).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('certificates').select('kind, level_num').eq('tenant_id', tid),
      supabase.from('tasks').select('id, title, status, priority, due_date').in('status', ['todo', 'in_progress']).order('created_at', { ascending: false }).limit(8),
      supabase.from('kpi_metrics').select('name, value, unit, trend, captured_at').eq('tenant_id', tid).order('captured_at', { ascending: false }).limit(8),
      supabase.from('events').select('event_type, payload, created_at').eq('tenant_id', tid).order('created_at', { ascending: false }).limit(6),
    ])

  const levels = (journeyState.data as Array<{ level: number; state: string; name_vi: string; color: string }> | null) ?? []
  const unlockedLevels = levels.filter((l) => l.state === 'unlocked').length
  const currentLevel = levels.find((l) => l.state !== 'locked' && l.state !== 'unlocked') ?? levels.find((l) => l.state === 'unlocked')

  const fmResult = finModel.data?.result as { runway?: { p50: number; p10: number }; survival_probability?: number; ending_arr?: { p50: number } } | undefined
  const capHolders = capTable.data?.holders as { founder_pct?: number; esop_pct?: number } | undefined

  // Days to IPO
  const targetYear = journey.data?.target_year
  const daysToIpo = targetYear ? Math.max(0, Math.round((new Date(targetYear, 11, 31).getTime() - Date.now()) / 86_400_000)) : null

  const certList = (certs.data as Array<{ kind: string }> | null) ?? []
  const readinessScore = readiness.data?.total_score != null ? Math.round(Number(readiness.data.total_score)) : null

  // Compute next best action from gaps
  const nextActions: string[] = []
  if (unlockedLevels === 0) nextActions.push('Hoàn thành Cấp 1 · Khai Tâm để khởi động hành trình')
  if (!capTable.data) nextActions.push('Dựng cap table v0')
  if (!finModel.data) nextActions.push('Chạy Financial Model để biết runway')
  if (readinessScore != null && readinessScore < 700 && currentLevel && currentLevel.level >= 6) nextActions.push('Nâng điểm IPO readiness lên ≥ 700')
  if ((tasks.data?.length ?? 0) > 0) nextActions.push(`${tasks.data?.length} task đang mở cần xử lý`)

  return NextResponse.json({
    data: {
      profile: profile.data,
      tenant: tenant.data,
      journey: {
        ...journey.data,
        days_to_ipo: daysToIpo,
        unlocked_levels: unlockedLevels,
        total_levels: 7,
        current_level: currentLevel ? { num: currentLevel.level, name: currentLevel.name_vi, state: currentLevel.state, color: currentLevel.color } : null,
        levels: levels.map((l) => ({ level: l.level, state: l.state, color: l.color, name: l.name_vi })),
      },
      readiness: { score: readinessScore, max: 1000, breakdown: readiness.data?.breakdown_by_category ?? null },
      runway: fmResult?.runway ? { p50_months: fmResult.runway.p50, p10_months: fmResult.runway.p10, survival: fmResult.survival_probability, ending_arr_p50: fmResult.ending_arr?.p50 } : null,
      cap_table: capTable.data ? { founder_pct: capHolders?.founder_pct ?? null, esop_pct: capHolders?.esop_pct ?? null, total_shares: capTable.data.total_shares, valuation_usd: capTable.data.valuation_usd } : null,
      certificates: { total: certList.length, has_master: certList.some((c) => c.kind === 'master') },
      tasks: tasks.data ?? [],
      kpis: kpis.data ?? [],
      recent_events: events.data ?? [],
      next_actions: nextActions,
    },
  })
}
