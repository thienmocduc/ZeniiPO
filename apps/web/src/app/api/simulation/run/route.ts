import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase/server'
import { requireUserAndTenant } from '@/lib/api/tenant'
import { runSimulation } from '@/lib/finance/simulation'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * POST /api/simulation/run — chạy kịch bản giả lập điều hành.
 *
 * `materialize: true` sẽ GHI kết quả vào financial_statements +
 * unit_economics_inputs (dấu vết ghi rõ là dữ liệu giả lập trong notes) để
 * người dùng tập điều hành trên đúng bộ dashboard/KPI/benchmark như công ty
 * thật — "giả lập nhưng thành tích đo bằng chuẩn thật".
 */

const AssumptionSchema = z.object({
  new_customer_growth_pct: z.number().min(-50).max(200).default(10),
  new_customers_month1: z.number().min(0).max(1_000_000).default(20),
  arpu: z.number().min(0).max(1e9).default(500),
  churn_pct: z.number().min(0).max(100).default(3),
  gross_margin_pct: z.number().min(-100).max(100).default(70),
  fixed_opex_month1: z.number().min(0).max(1e12).default(20_000),
  opex_growth_pct: z.number().min(-50).max(100).default(3),
  cac: z.number().min(0).max(1e9).default(400),
  revenue_per_employee_year: z.number().min(1).max(1e9).default(150_000),
  salary_per_employee_month: z.number().min(0).max(1e7).default(2_000),
  starting_cash: z.number().min(0).max(1e12).default(500_000),
  min_cash_floor: z.number().min(0).max(1e12).default(100_000),
  funding_round_size: z.number().min(0).max(1e12).default(2_000_000),
})

const BodySchema = z.object({
  name: z.string().trim().min(1).max(120).default('Kịch bản giả lập'),
  months: z.number().int().min(1).max(120).default(24),
  assumptions: AssumptionSchema.default({}),
  materialize: z.boolean().default(false),
})

export async function POST(req: Request) {
  const supabase = await createServerClient()
  const auth = await requireUserAndTenant(supabase)
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status })

  const body = await req.json().catch(() => ({}))
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { name, months, assumptions, materialize } = parsed.data
  const result = runSimulation(assumptions, months)

  const { data: saved } = await supabase
    .from('simulation_scenarios')
    .insert({
      tenant_id: auth.tenantId,
      name,
      base_revenue: result.months[0]?.revenue ?? 0,
      base_customers: result.months[0]?.customers ?? 0,
      assumptions,
      months,
      result: { summary: result.summary, months: result.months.slice(0, 60) },
      status: 'done',
      created_by: auth.user.id,
    })
    .select('id, created_at')
    .single()

  let materialized = 0
  if (materialize) {
    // Ghi ngược về bảng vận hành để dashboard/KPI/benchmark chạy như thật.
    const start = new Date()
    start.setDate(1)
    start.setMonth(start.getMonth() - result.months.length + 1)

    const fin = result.months.map((m, i) => {
      const d = new Date(start)
      d.setMonth(start.getMonth() + i)
      const period = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
      return {
        tenant_id: auth.tenantId,
        period,
        revenue: m.revenue,
        cogs: m.cogs,
        opex_sales: m.sm_spend,
        opex_rnd: Math.round(m.payroll * 0.4),
        opex_ga: Math.round(m.payroll * 0.6 + m.fixed_opex),
        other_income: 0,
        capex: 0,
        cash_balance: m.cash,
        notes: `[GIẢ LẬP] ${name}`,
      }
    })
    const ue = result.months.map((m, i) => {
      const d = new Date(start)
      d.setMonth(start.getMonth() + i)
      const period = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
      const prev = result.months[i - 1]
      return {
        tenant_id: auth.tenantId,
        period,
        new_customers: m.new_customers,
        churned_customers: m.churned_customers,
        active_customers: m.customers,
        starting_mrr: prev ? prev.revenue : 0,
        new_mrr: m.new_customers * assumptions.arpu,
        expansion_mrr: 0,
        contraction_mrr: 0,
        churned_mrr: m.churned_customers * assumptions.arpu,
        notes: `[GIẢ LẬP] ${name}`,
      }
    })

    const f = await supabase.from('financial_statements').upsert(fin, { onConflict: 'tenant_id,period' }).select('id')
    const u = await supabase.from('unit_economics_inputs').upsert(ue, { onConflict: 'tenant_id,period' }).select('id')
    materialized = (f.data?.length ?? 0) + (u.data?.length ?? 0)

    await supabase
      .from('tenant_operating_profile')
      .upsert({ tenant_id: auth.tenantId, mode: 'simulation', data_source: 'simulated' }, { onConflict: 'tenant_id' })
  }

  return NextResponse.json({
    data: {
      id: saved?.id ?? null,
      name,
      months,
      summary: result.summary,
      series: result.months,
      materialized_rows: materialized,
    },
  })
}
