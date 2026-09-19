import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase/server'
import { requireUserAndTenant } from '@/lib/api/tenant'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * masterplan_years — BẢN ĐỒ NHIỀU NĂM từ hôm nay tới IPO.
 * Mỗi năm: doanh thu · biên · EBITDA · nhân sự · vốn gọi · định giá · cột mốc,
 * gắn với 1 trong 10 bước hành trình. Đây là "financial roadmap" mà chủ tịch/CEO
 * dùng để lái công ty; /api/masterplan/review đối chiếu với P&L thực.
 */

export async function GET() {
  const supabase = await createServerClient()
  const auth = await requireUserAndTenant(supabase)
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status })

  const [years, journey] = await Promise.all([
    supabase.from('masterplan_years').select('*').order('year', { ascending: true }),
    supabase
      .from('ipo_journeys')
      .select('current_phase, target_year, valuation_target, north_star_metric')
      .eq('status', 'active')
      .limit(1),
  ])
  if (years.error) return NextResponse.json({ error: years.error.message }, { status: 500 })
  return NextResponse.json({ data: { years: years.data ?? [], journey: journey.data?.[0] ?? null } })
}

const Money = z.number().finite().min(-1e15).max(1e15)
const PostSchema = z.object({
  year: z.number().int().min(2020).max(2060),
  phase: z.number().int().min(1).max(10).optional(),
  revenue_target: Money.optional(),
  gross_margin_target_pct: z.number().min(-100).max(100).optional(),
  ebitda_target: Money.optional(),
  headcount_target: z.number().int().min(0).max(1_000_000).optional(),
  funding_target: Money.optional(),
  funding_round_code: z.string().trim().max(32).optional(),
  valuation_target: Money.optional(),
  key_milestone: z.string().trim().max(300).optional(),
  notes: z.string().trim().max(1000).optional(),
})

export async function POST(req: Request) {
  const supabase = await createServerClient()
  const auth = await requireUserAndTenant(supabase)
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status })

  const body = await req.json().catch(() => ({}))
  const parsed = PostSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { data, error } = await supabase
    .from('masterplan_years')
    .upsert({ tenant_id: auth.tenantId, ...parsed.data }, { onConflict: 'tenant_id,year' })
    .select('id, year, revenue_target')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}
