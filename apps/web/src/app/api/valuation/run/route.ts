import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase/server'
import { requireUserAndTenant } from '@/lib/api/tenant'
import { valuateComparables, valuateDcf, valuateVcMethod } from '@/lib/finance/valuation'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * POST /api/valuation/run — định giá doanh nghiệp bằng 1 trong 3 phương pháp.
 * Input tài chính lấy TỰ ĐỘNG từ financial_statements (12 tháng gần nhất) +
 * peer từ bảng comparables — người dùng chỉ nhập giả định (WACC, exit multiple…).
 * Kết quả lưu valuation_runs để có lịch sử + audit trail cho DD.
 */

const BodySchema = z.discriminatedUnion('method', [
  z.object({
    method: z.literal('comparables'),
    net_debt: z.number().finite().optional(),
    illiquidity_discount_pct: z.number().min(0).max(60).optional(),
  }),
  z.object({
    method: z.literal('dcf'),
    fcf_year1: z.number().finite().optional(),
    growth_rate_pct: z.number().min(-50).max(300),
    years: z.number().int().min(1).max(20),
    wacc_pct: z.number().min(1).max(80),
    terminal_growth_pct: z.number().min(-5).max(10),
    net_debt: z.number().finite().optional(),
  }),
  z.object({
    method: z.literal('vc_method'),
    exit_revenue: z.number().finite().positive(),
    exit_multiple: z.number().positive().max(100),
    years_to_exit: z.number().int().min(1).max(15),
    target_irr_pct: z.number().min(5).max(200),
    investment_usd: z.number().finite().positive(),
    future_dilution_pct: z.number().min(0).max(80).optional(),
  }),
])

export async function POST(req: Request) {
  const supabase = await createServerClient()
  const auth = await requireUserAndTenant(supabase)
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status })

  const body = await req.json().catch(() => ({}))
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  const input = parsed.data

  // Tài chính 12 tháng gần nhất → TTM revenue/EBITDA (nguồn sự thật P&L).
  const { data: fin } = await supabase
    .from('financial_statements')
    .select('revenue, cogs, opex_sales, opex_rnd, opex_ga, other_income, capex')
    .order('period', { ascending: false })
    .limit(12)
  const rows = fin ?? []
  const ttmRevenue = rows.reduce((a, r) => a + Number(r.revenue ?? 0), 0)
  const ttmEbitda = rows.reduce(
    (a, r) =>
      a +
      (Number(r.revenue ?? 0) - Number(r.cogs ?? 0) - Number(r.opex_sales ?? 0) -
        Number(r.opex_rnd ?? 0) - Number(r.opex_ga ?? 0) + Number(r.other_income ?? 0)),
    0,
  )
  const ttmCapex = rows.reduce((a, r) => a + Number(r.capex ?? 0), 0)

  let result: Record<string, unknown>

  if (input.method === 'comparables') {
    if (ttmRevenue <= 0) {
      return NextResponse.json(
        { error: 'Chưa có doanh thu trong P&L — nhập financial statements trước khi định giá theo bội số.' },
        { status: 422 },
      )
    }
    const { data: peers } = await supabase
      .from('comparables')
      .select('company_name, ev_revenue_multiple, ev_ebitda_multiple, pe_ratio')
      .limit(50)
    if (!peers || peers.length === 0) {
      return NextResponse.json(
        { error: 'Chưa có peer company nào — thêm comparables trước (trang Comparables).' },
        { status: 422 },
      )
    }
    result = valuateComparables({
      revenue: ttmRevenue,
      ebitda: ttmEbitda,
      net_debt: input.net_debt,
      comparables: peers,
      illiquidity_discount_pct: input.illiquidity_discount_pct,
    }) as unknown as Record<string, unknown>
  } else if (input.method === 'dcf') {
    // FCF năm 1: client truyền, hoặc ước = EBITDA(TTM) − CAPEX(TTM).
    const fcf1 = input.fcf_year1 ?? ttmEbitda - ttmCapex
    if (!Number.isFinite(fcf1)) {
      return NextResponse.json({ error: 'Không xác định được FCF năm 1 — nhập tay hoặc bổ sung P&L.' }, { status: 422 })
    }
    result = valuateDcf({
      fcf_year1: fcf1,
      growth_rate_pct: input.growth_rate_pct,
      years: input.years,
      wacc_pct: input.wacc_pct,
      terminal_growth_pct: input.terminal_growth_pct,
      net_debt: input.net_debt,
    }) as unknown as Record<string, unknown>
    if ((result as { error?: string }).error) {
      return NextResponse.json({ error: (result as { error: string }).error }, { status: 422 })
    }
  } else {
    result = valuateVcMethod(input) as unknown as Record<string, unknown>
  }

  const { data: saved, error } = await supabase
    .from('valuation_runs')
    .insert({
      tenant_id: auth.tenantId,
      method: input.method,
      inputs: { ...input, ttm_revenue: ttmRevenue, ttm_ebitda: ttmEbitda },
      result,
      enterprise_value_usd: (result.enterprise_value as number | null) ?? null,
      equity_value_usd: (result.equity_value as number | null) ?? null,
      created_by: auth.user.id,
    })
    .select('id, created_at')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    data: { id: saved.id, created_at: saved.created_at, ttm: { revenue: ttmRevenue, ebitda: ttmEbitda }, ...result },
  })
}
