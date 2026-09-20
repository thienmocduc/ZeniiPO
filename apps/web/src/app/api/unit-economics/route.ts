import { NextResponse } from 'next/server'
import { z } from 'zod'
import { SoTien } from '@/lib/tien/so-tien'
import { createServerClient } from '@/lib/supabase/server'
import { requireUserAndTenant } from '@/lib/api/tenant'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * unit_economics_inputs — input vận hành theo tháng (khách + MRR movement).
 * Đây là nguồn cho toàn bộ công thức MBA: CAC/LTV/NRR/GRR/Rule of 40…
 * (chi phí S&M lấy từ financial_statements.opex_sales — không nhập 2 lần).
 */

export async function GET() {
  const supabase = await createServerClient()
  const auth = await requireUserAndTenant(supabase)
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status })

  const { data, error } = await supabase
    .from('unit_economics_inputs')
    .select('*')
    .order('period', { ascending: false })
    .limit(24)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

/** Nam cot MRR duoi day deu la TIEN => so nguyen (cot CSDL la bigint). */
const Num = SoTien
const PostSchema = z.object({
  period: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'period dạng YYYY-MM'),
  new_customers: z.number().int().min(0).max(1e9).default(0),
  churned_customers: z.number().int().min(0).max(1e9).default(0),
  active_customers: z.number().int().min(0).max(1e9).default(0),
  starting_mrr: Num.default(0),
  new_mrr: Num.default(0),
  expansion_mrr: Num.default(0),
  contraction_mrr: Num.default(0),
  churned_mrr: Num.default(0),
  notes: z.string().trim().max(1000).optional(),
})

export async function POST(req: Request) {
  const supabase = await createServerClient()
  const auth = await requireUserAndTenant(supabase)
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status })

  const body = await req.json().catch(() => ({}))
  const parsed = PostSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { period, ...rest } = parsed.data
  const { data, error } = await supabase
    .from('unit_economics_inputs')
    .upsert({ tenant_id: auth.tenantId, period: `${period}-01`, ...rest }, { onConflict: 'tenant_id,period' })
    .select('id, period, active_customers')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}
