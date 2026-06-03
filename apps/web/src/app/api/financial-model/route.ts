import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase/server'
import { requireUserAndTenant } from '@/lib/api/tenant'
import { runMonteCarlo, sensitivityGrid, type ModelAssumptions } from '@/lib/finance/monte-carlo'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// GET — latest model + cached result for the tenant.
export async function GET() {
  const supabase = await createServerClient()
  const auth = await requireUserAndTenant(supabase)
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status })

  const { data, error } = await supabase
    .from('financial_models')
    .select('*')
    .eq('tenant_id', auth.tenantId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

// POST — save assumptions, run Monte Carlo (1000 trials) + sensitivity, cache result.
const AssumptionsSchema = z.object({
  name: z.string().trim().max(80).optional(),
  starting_cash: z.number().nonnegative(),
  monthly_revenue: z.number().nonnegative(),
  monthly_growth_mean: z.number().min(-0.5).max(2),
  monthly_growth_volatility: z.number().min(0).max(1),
  gross_margin: z.number().min(0).max(1),
  monthly_fixed_costs: z.number().nonnegative(),
  horizon_months: z.number().int().min(6).max(120),
  target_arr: z.number().nonnegative().optional(),
})

export async function POST(req: Request) {
  const supabase = await createServerClient()
  const auth = await requireUserAndTenant(supabase)
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status })

  const body = await req.json().catch(() => ({}))
  const parsed = AssumptionsSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const assumptions: ModelAssumptions = { ...parsed.data, trials: 1000, seed: 42 }
  const result = runMonteCarlo(assumptions)
  const sensitivity = sensitivityGrid(assumptions)

  // resolve journey (optional link)
  const { data: j } = await supabase
    .from('ipo_journeys')
    .select('id')
    .eq('tenant_id', auth.tenantId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data, error } = await supabase
    .from('financial_models')
    .insert({
      tenant_id: auth.tenantId,
      journey_id: j?.id ?? null,
      name: parsed.data.name ?? 'Base case',
      assumptions,
      result,
      sensitivity,
      created_by: auth.user.id,
    })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data, result, sensitivity }, { status: 201 })
}
