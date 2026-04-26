import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase/server'
import { requireUserAndTenant } from '@/lib/api/tenant'
import { safeString } from '@/lib/security/schemas'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const Schema = z.object({
  // Step 1: journey
  journey_name: safeString.min(1).max(120),
  target_year: z.number().int().min(2026).max(2050),
  exit_venue: z.enum(['sgx', 'nasdaq', 'nyse', 'hkex', 'hose']),
  valuation_target_usd: z.number().positive(),
  industry: safeString.max(80),
  north_star_metric: safeString.max(120),
  // Step 2: 4 KPIs
  kpis: z.array(z.object({
    metric_code: safeString.min(1).max(60),
    name: safeString.min(1).max(120),
    value: z.number(),
    unit: safeString.optional(),
    period: safeString.optional(),
  })).length(4),
  // Step 3: 1 OKR Chairman
  okr_title: safeString.min(1).max(200),
  okr_description: safeString.optional(),
})

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const parsed = Schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const supabase = await createServerClient()
  const auth = await requireUserAndTenant(supabase)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status })
  }

  const p = parsed.data

  // Block if tenant already has any journey (idempotent guard).
  const { count: existing } = await supabase
    .from('ipo_journeys')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', auth.tenantId)
  if ((existing ?? 0) > 0) {
    return NextResponse.json({ error: 'Onboarding already complete (journey exists)' }, { status: 409 })
  }

  // Step 1+3: cascade RPC creates journey + 4 CHR objectives + readiness criteria seed.
  const cascade = await supabase.rpc('cascade_chairman_event', {
    p_tenant_id: auth.tenantId,
    p_valuation: p.valuation_target_usd,
    p_venue: p.exit_venue,
    p_year: p.target_year,
    p_industry: p.industry,
    p_strategy: p.north_star_metric,
  })
  if (cascade.error) {
    return NextResponse.json({ error: `cascade: ${cascade.error.message}` }, { status: 500 })
  }
  const journeyId = (cascade.data as { journey_id?: string } | null)?.journey_id

  // Update journey name (cascade RPC uses default name).
  if (journeyId && p.journey_name) {
    await supabase
      .from('ipo_journeys')
      .update({ name: p.journey_name, north_star_metric: p.north_star_metric, industry: p.industry })
      .eq('id', journeyId)
  }

  // Step 2: 4 KPIs
  const kpiInserts = p.kpis.map((k) => ({
    tenant_id: auth.tenantId,
    metric_code: k.metric_code,
    name: k.name,
    value: k.value,
    unit: k.unit ?? null,
    period: k.period ?? new Date().toISOString().slice(0, 7),
    captured_at: new Date().toISOString(),
  }))
  const kpiRes = await supabase.from('kpi_metrics').insert(kpiInserts).select('id, name')

  // Step 3: 1 OKR Chairman (link to existing CHR objectives if cascade created any).
  // We append a new "user-defined" CHR objective alongside the 4 cascade-default ones.
  const okrRes = await supabase
    .from('okr_objectives')
    .insert({
      tenant_id: auth.tenantId,
      title: p.okr_title,
      description: p.okr_description ?? null,
      tier: 'chr',
      created_by: auth.user.id,
    })
    .select('id, title')
    .single()

  return NextResponse.json({
    data: {
      journey_id: journeyId,
      kpis_created: kpiRes.data?.length ?? 0,
      okr_id: okrRes.data?.id,
      kpi_error: kpiRes.error?.message,
      okr_error: okrRes.error?.message,
    },
  }, { status: 201 })
}
