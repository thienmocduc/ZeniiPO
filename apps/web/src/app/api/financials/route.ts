import { NextResponse } from 'next/server'
import { z } from 'zod'
import { SoTien } from '@/lib/tien/so-tien'
import { createServerClient } from '@/lib/supabase/server'
import { requireUserAndTenant } from '@/lib/api/tenant'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * financial_statements — nguồn sự thật P&L + cashflow theo tháng.
 * GET  → 24 tháng gần nhất (desc) + tổng hợp derived phía server cho UI.
 * POST → upsert 1 tháng (period 'YYYY-MM'), mọi số mặc định 0.
 */

export async function GET() {
  const supabase = await createServerClient()
  const auth = await requireUserAndTenant(supabase)
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status })

  const { data, error } = await supabase
    .from('financial_statements')
    .select('*')
    .order('period', { ascending: false })
    .limit(24)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

/** Số tiền — định nghĩa dùng chung, bắt buộc số nguyên (CSDL là bigint). */
const MoneySchema = SoTien
const PostSchema = z.object({
  period: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'period dạng YYYY-MM'),
  revenue: MoneySchema.default(0),
  cogs: MoneySchema.default(0),
  opex_sales: MoneySchema.default(0),
  opex_rnd: MoneySchema.default(0),
  opex_ga: MoneySchema.default(0),
  other_income: MoneySchema.default(0),
  capex: MoneySchema.default(0),
  cash_balance: MoneySchema.optional(),
  accounts_receivable: MoneySchema.optional(),
  inventory: MoneySchema.optional(),
  accounts_payable: MoneySchema.optional(),
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
    .from('financial_statements')
    .upsert(
      { tenant_id: auth.tenantId, period: `${period}-01`, ...rest },
      { onConflict: 'tenant_id,period' },
    )
    .select('id, period, revenue, cash_balance')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}
