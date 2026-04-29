import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { isAuthorizedCron } from '@/lib/cron/auth'
import { emailWeeklyDigest } from '@/lib/email/templates'
import { isResendConfigured } from '@/lib/email/client'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300

/**
 * Mondays 08:00 SGT — for every tenant with at least one chairman/CEO,
 * pick the senior-most chr/ceo profile and send a branded weekly digest:
 *   KPI snapshot · open task count · readiness score · events this week.
 *
 * No-op when Resend is not configured (lib/email/client returns null) so
 * the cron still succeeds in environments without RESEND_API_KEY.
 */
export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (!isResendConfigured()) {
    return NextResponse.json({
      data: { skipped: true, reason: 'RESEND_API_KEY missing' },
    })
  }

  const sb = createServiceClient()
  const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString()

  const { data: tenants, error: tErr } = await sb
    .from('tenants')
    .select('id, name')
  if (tErr) return NextResponse.json({ error: tErr.message }, { status: 500 })

  const sent: Array<{ tenant_id: string; tenant_name: string; recipient: string; ok: boolean }> = []
  const skipped: Array<{ tenant_id: string; reason: string }> = []

  for (const t of tenants ?? []) {
    // Pick the most-active chairman/ceo profile for this tenant.
    const { data: profile } = await sb
      .from('user_profiles')
      .select('id, email, full_name, role')
      .eq('tenant_id', t.id)
      .in('role', ['chr', 'ceo'])
      .order('last_active_at', { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle()
    if (!profile?.email) {
      skipped.push({ tenant_id: t.id, reason: 'no chr/ceo recipient' })
      continue
    }

    // Latest KPIs (5)
    const { data: kpiRows } = await sb
      .from('kpi_metrics')
      .select('name, value, unit, trend')
      .eq('tenant_id', t.id)
      .order('captured_at', { ascending: false })
      .limit(20)
    const seen = new Set<string>()
    const kpis: Array<{ name: string; value: number; unit?: string; trend?: 'up' | 'down' | 'flat' }> = []
    for (const k of kpiRows ?? []) {
      const r = k as { name: string; value: number; unit: string | null; trend: string | null }
      if (seen.has(r.name)) continue
      seen.add(r.name)
      kpis.push({
        name: r.name,
        value: Number(r.value),
        unit: r.unit ?? undefined,
        trend: (r.trend === 'up' || r.trend === 'down' || r.trend === 'flat' ? r.trend : 'flat'),
      })
      if (kpis.length >= 6) break
    }

    // Open task count
    const { count: openTasks } = await sb
      .from('tasks')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', t.id)
      .in('status', ['todo', 'in_progress'])

    // Latest readiness score
    const { data: readiness } = await sb
      .from('readiness_score_history')
      .select('total_score')
      .eq('tenant_id', t.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    // Events this week
    const { count: events } = await sb
      .from('events')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', t.id)
      .gte('created_at', weekAgo)

    const result = await emailWeeklyDigest({
      to: profile.email,
      tenant_name: t.name,
      kpis_summary: kpis,
      open_tasks: openTasks ?? 0,
      readiness_score: readiness?.total_score != null ? Math.round(Number(readiness.total_score)) : null,
      events_this_week: events ?? 0,
    })
    sent.push({ tenant_id: t.id, tenant_name: t.name, recipient: profile.email, ok: Boolean(result) })
  }

  return NextResponse.json({
    data: { sent: sent.length, skipped: skipped.length, sent_detail: sent, skipped_detail: skipped },
  })
}
