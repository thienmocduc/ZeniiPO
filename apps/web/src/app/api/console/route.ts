import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Zeni Console API — platform operator + holdings cockpit.
 *
 * Cross-tenant aggregation for chairman_super only. We verify identity with the
 * USER session (RLS-bound), then switch to the service client for the actual
 * aggregation so RLS edge-cases on grouped reads can't silently drop rows.
 * The service client is NEVER reachable without passing the is_chairman_super
 * gate first.
 */

const TEST_EMAIL = /@test\.local$|zeniipo-test|\.example\.com$/i
const DAY = 86_400_000

function monthKey(iso: string): string {
  return iso.slice(0, 7) // YYYY-MM
}

async function assertSuper() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false as const, status: 401 as const, message: 'Unauthorized' }
  const { data: isSuper } = await supabase.rpc('is_chairman_super')
  if (!isSuper) return { ok: false as const, status: 403 as const, message: 'Forbidden — chairman_super only' }
  return { ok: true as const, user }
}

export async function GET() {
  const gate = await assertSuper()
  if (!gate.ok) return NextResponse.json({ error: gate.message }, { status: gate.status })

  const svc = createServiceClient()

  // ── tenants (feature-detect parent_tenant_id) ──────────────────
  let needsMigration = false
  let tenants:
    Array<{ id: string; name: string; slug: string; plan: string | null; owner_id: string | null; created_at: string; parent_tenant_id?: string | null }>
    = []
  {
    const withParent = await svc
      .from('tenants')
      .select('id, name, slug, plan, owner_id, created_at, parent_tenant_id')
      .order('created_at', { ascending: true })
    if (withParent.error) {
      needsMigration = true
      const fallback = await svc
        .from('tenants')
        .select('id, name, slug, plan, owner_id, created_at')
        .order('created_at', { ascending: true })
      tenants = (fallback.data ?? []) as typeof tenants
    } else {
      tenants = (withParent.data ?? []) as typeof tenants
    }
  }

  // ── parallel reads ─────────────────────────────────────────────
  const [profilesRes, journeysRes, subsRes, eventsRes, readinessRes, okrRes] = await Promise.all([
    svc.from('user_profiles').select('id, email, full_name, role, tenant_id, is_chairman_super, last_active_at, created_at'),
    svc.from('ipo_journeys').select('id, tenant_id, name, current_phase, target_year, valuation_target, status, created_at'),
    svc.from('subscriptions').select('tenant_id, plan, status, tier_code, current_period_end'),
    svc.from('events').select('tenant_id, event_type, created_at').order('created_at', { ascending: false }).limit(400),
    svc.from('readiness_score_history').select('tenant_id, total_score, captured_at').order('captured_at', { ascending: false }),
    svc.from('okr_objectives').select('tenant_id'),
  ])

  const profiles = profilesRes.data ?? []
  const journeys = journeysRes.data ?? []
  const subs = subsRes.data ?? []
  const events = eventsRes.data ?? []
  const readiness = readinessRes.data ?? []
  const okrs = okrRes.data ?? []

  const now = Date.now()

  // ── per-tenant rollups ─────────────────────────────────────────
  const membersByTenant = new Map<string, typeof profiles>()
  for (const p of profiles) {
    if (!p.tenant_id) continue
    const arr = membersByTenant.get(p.tenant_id) ?? []
    arr.push(p)
    membersByTenant.set(p.tenant_id, arr)
  }

  const journeyByTenant = new Map<string, typeof journeys[number]>()
  for (const j of journeys) if (!journeyByTenant.has(j.tenant_id)) journeyByTenant.set(j.tenant_id, j)

  const latestReadinessByTenant = new Map<string, number>()
  for (const r of readiness) {
    if (!latestReadinessByTenant.has(r.tenant_id) && typeof r.total_score === 'number') {
      latestReadinessByTenant.set(r.tenant_id, r.total_score)
    }
  }

  const okrCountByTenant = new Map<string, number>()
  for (const o of okrs) okrCountByTenant.set(o.tenant_id, (okrCountByTenant.get(o.tenant_id) ?? 0) + 1)

  const eventTenants30d = new Set<string>()
  for (const e of events) {
    if (e.tenant_id && now - new Date(e.created_at).getTime() < 30 * DAY) eventTenants30d.add(e.tenant_id)
  }

  function isTestTenant(tenantId: string, plan: string | null): boolean {
    // Paid/enterprise tenants are always real customers (seeded brands included).
    if ((plan ?? '').toLowerCase() === 'enterprise') return false
    const members = membersByTenant.get(tenantId) ?? []
    if (members.length === 0) return true // orphan free tenant = E2E junk
    return members.every((m) => !m.email || TEST_EMAIL.test(m.email))
  }

  function lastActive(tenantId: string): string | null {
    const members = membersByTenant.get(tenantId) ?? []
    let max = 0
    for (const m of members) {
      const t = m.last_active_at ? new Date(m.last_active_at).getTime() : 0
      if (t > max) max = t
    }
    return max ? new Date(max).toISOString() : null
  }

  const ownerEmail = (ownerId: string | null | undefined): string | null => {
    if (!ownerId) return null
    return profiles.find((p) => p.id === ownerId)?.email ?? null
  }

  const tenantRows = tenants.map((t) => {
    const members = membersByTenant.get(t.id) ?? []
    const j = journeyByTenant.get(t.id)
    const la = lastActive(t.id)
    const active30 = eventTenants30d.has(t.id) || (la ? now - new Date(la).getTime() < 30 * DAY : false)
    return {
      id: t.id,
      name: t.name,
      slug: t.slug,
      plan: t.plan ?? 'free',
      owner_email: ownerEmail(t.owner_id),
      users_count: members.length,
      phase: j?.current_phase ?? null,
      journey_name: j?.name ?? null,
      readiness: latestReadinessByTenant.get(t.id) ?? null,
      okr_count: okrCountByTenant.get(t.id) ?? 0,
      created_at: t.created_at,
      last_active: la,
      active_30d: active30,
      is_test: isTestTenant(t.id, t.plan ?? null),
      parent_tenant_id: t.parent_tenant_id ?? null,
    }
  })

  const realTenants = tenantRows.filter((t) => !t.is_test)

  // ── operator overview ──────────────────────────────────────────
  const activeSubs = subs.filter((s) => s.status === 'active' || s.status === 'trialing')
  const planByCode: Record<string, number> = { free: 0, explorer: 0, pro: 0, elite: 0, enterprise: 0 }
  for (const t of realTenants) {
    const p = (t.plan ?? 'free').toLowerCase()
    planByCode[p] = (planByCode[p] ?? 0) + 1
  }

  // signups by month (real customers, last 6 months)
  const signupsMap = new Map<string, number>()
  for (const t of realTenants) {
    const k = monthKey(t.created_at)
    signupsMap.set(k, (signupsMap.get(k) ?? 0) + 1)
  }
  const months: string[] = []
  {
    const d = new Date(now)
    for (let i = 5; i >= 0; i--) {
      const m = new Date(d.getFullYear(), d.getMonth() - i, 1)
      months.push(`${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}`)
    }
  }
  const signups_by_month = months.map((m) => ({ month: m, count: signupsMap.get(m) ?? 0 }))

  const realTenantIds = new Set(realTenants.map((t) => t.id))
  const realJourneys = journeys.filter((j) => realTenantIds.has(j.tenant_id))
  const realActiveUsers = profiles.filter((p) => p.email && !TEST_EMAIL.test(p.email))

  const operator = {
    counts: {
      tenants_total: tenantRows.length,
      tenants_real: realTenants.length,
      tenants_test: tenantRows.length - realTenants.length,
      users: realActiveUsers.length,
      users_total: profiles.length,
      journeys: realJourneys.length,
      active_30d: realTenants.filter((t) => t.active_30d).length,
    },
    revenue: {
      mrr_usd: 0, // wired when Stripe subscriptions land
      active_subs: activeSubs.length,
      by_plan: planByCode,
    },
    signups_by_month,
    recent_signups: realTenants
      .slice()
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 8)
      .map((t) => ({ name: t.name, slug: t.slug, plan: t.plan, created_at: t.created_at, owner_email: t.owner_email })),
  }

  // ── holdings cockpit ───────────────────────────────────────────
  const parent = tenants.find((t) => t.slug === 'zeni')
  const kpiLatest = await svc
    .from('kpi_metrics')
    .select('tenant_id, metric_code, value, captured_at')
    .order('captured_at', { ascending: false })
  const kpiByTenant = new Map<string, Record<string, number>>()
  for (const k of kpiLatest.data ?? []) {
    const m = kpiByTenant.get(k.tenant_id) ?? {}
    if (!(k.metric_code in m) && typeof k.value === 'number') m[k.metric_code] = k.value
    kpiByTenant.set(k.tenant_id, m)
  }
  const runwayOf = (tid: string): number | null => {
    const m = kpiByTenant.get(tid) ?? {}
    const cash = m.cash_balance
    const burn = m.monthly_burn
    if (typeof cash === 'number' && typeof burn === 'number' && burn > 0) return Math.round((cash / burn) * 10) / 10
    return null
  }

  const subsidiaryRows = parent
    ? tenantRows
        .filter((t) => t.parent_tenant_id === parent.id)
        .map((t) => ({
          id: t.id,
          name: t.name,
          slug: t.slug,
          phase: t.phase,
          readiness: t.readiness,
          okr_count: t.okr_count,
          users_count: t.users_count,
          cash_usd: kpiByTenant.get(t.id)?.cash_balance ?? null,
          runway_months: runwayOf(t.id),
          mrr_usd: kpiByTenant.get(t.id)?.mrr ?? 0,
        }))
    : []

  const readinessVals = subsidiaryRows.map((s) => s.readiness).filter((v): v is number => typeof v === 'number')
  const holdings = {
    parent: parent ? { id: parent.id, name: parent.name, slug: parent.slug } : null,
    subsidiaries: subsidiaryRows,
    rollup: {
      companies: subsidiaryRows.length,
      avg_readiness: readinessVals.length ? Math.round(readinessVals.reduce((a, b) => a + b, 0) / readinessVals.length) : null,
      total_cash_usd: subsidiaryRows.reduce((a, s) => a + (s.cash_usd ?? 0), 0),
      total_okrs: subsidiaryRows.reduce((a, s) => a + s.okr_count, 0),
      total_mrr_usd: subsidiaryRows.reduce((a, s) => a + (s.mrr_usd ?? 0), 0),
    },
    // candidates the chairman can attach as subsidiaries (real, not already child, not the parent)
    candidates: realTenants
      .filter((t) => t.id !== parent?.id && !t.parent_tenant_id)
      .map((t) => ({ id: t.id, name: t.name, slug: t.slug })),
  }

  // ── system health ──────────────────────────────────────────────
  const events24h = events.filter((e) => now - new Date(e.created_at).getTime() < DAY).length
  const events7d = events.filter((e) => now - new Date(e.created_at).getTime() < 7 * DAY).length
  const health = {
    events_24h: events24h,
    events_7d: events7d,
    recent_events: events.slice(0, 20).map((e) => ({ event_type: e.event_type, created_at: e.created_at, tenant_id: e.tenant_id })),
    last_event_at: events[0]?.created_at ?? null,
  }

  return NextResponse.json({
    data: { operator, tenants: tenantRows, users: usersPayload(profiles, tenants), holdings, health, needs_migration: needsMigration },
  })
}

function usersPayload(
  profiles: Array<{ id: string; email: string | null; full_name: string | null; role: string | null; tenant_id: string | null; is_chairman_super?: boolean | null; last_active_at: string | null }>,
  tenants: Array<{ id: string; name: string }>,
) {
  const tName = new Map(tenants.map((t) => [t.id, t.name]))
  return profiles
    .filter((p) => p.email && !TEST_EMAIL.test(p.email))
    .sort((a, b) => (new Date(b.last_active_at ?? 0).getTime()) - (new Date(a.last_active_at ?? 0).getTime()))
    .slice(0, 200)
    .map((p) => ({
      id: p.id,
      email: p.email,
      full_name: p.full_name,
      role: p.role,
      tenant_name: p.tenant_id ? tName.get(p.tenant_id) ?? null : null,
      is_super: Boolean(p.is_chairman_super),
      last_active: p.last_active_at,
    }))
}

// ─── POST: assign / detach a subsidiary (set_parent) ─────────────
const PostSchema = z.object({
  action: z.literal('set_parent'),
  tenant_id: z.string().uuid(),
  parent_tenant_id: z.string().uuid().nullable(),
})

export async function POST(req: Request) {
  const gate = await assertSuper()
  if (!gate.ok) return NextResponse.json({ error: gate.message }, { status: gate.status })

  const body = await req.json().catch(() => ({}))
  const parsed = PostSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  const { tenant_id, parent_tenant_id } = parsed.data

  if (tenant_id === parent_tenant_id) {
    return NextResponse.json({ error: 'A tenant cannot be its own parent' }, { status: 400 })
  }

  const svc = createServiceClient()
  const upd = await svc.from('tenants').update({ parent_tenant_id }).eq('id', tenant_id).select('id, name, parent_tenant_id').single()
  if (upd.error) {
    const needsMigration = /parent_tenant_id/.test(upd.error.message)
    return NextResponse.json(
      { error: upd.error.message, needs_migration: needsMigration },
      { status: needsMigration ? 409 : 500 },
    )
  }
  return NextResponse.json({ data: upd.data })
}
