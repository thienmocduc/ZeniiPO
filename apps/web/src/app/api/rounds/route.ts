import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase/server'
import { getCurrentTenantId } from '@/lib/api/tenant'
import { safeString } from '@/lib/security/schemas'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const STATUSES = ['planning', 'outreach', 'dd', 'term_sheet', 'closing', 'closed'] as const

/**
 * Tên trường KHỚP ĐÚNG cột của bảng `fundraise_rounds`.
 *
 * Bản trước khai `name`, `round_type`, `target_amount`, `pre_money_valuation`,
 * `opened_at`, `expected_close_at` — KHÔNG cột nào trong số đó tồn tại. Cả sáu
 * đều nằm ở nhánh ghi, nên endpoint tạo vòng gọi vốn **chưa bao giờ tạo được
 * một bản ghi nào**: mọi lần gọi đều rơi vào lỗi 500.
 *
 * Tiền ở bảng này ghi bằng USD (`*_usd`) vì vòng gọi vốn quốc tế yết theo USD;
 * đây là ngoại lệ có chủ đích so với quy ước "tiền là BIGINT VND".
 */
const CreateSchema = z.object({
  round_name: safeString.min(1),
  /** Mã vòng: seed, series_a… Dùng cho đối chiếu và sắp xếp. */
  round_code: safeString.min(1),
  target_raise_usd: z.number().positive(),
  pre_money_usd: z.number().positive().optional(),
  status: z.enum(STATUSES).optional(),
  /** Ngày dự kiến chốt vòng. */
  target_close_date: safeString.optional(),
  lead_investor: safeString.optional(),
})

export async function GET() {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('fundraise_rounds')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tenantId = await getCurrentTenantId(supabase, user.id)
  if (!tenantId) {
    return NextResponse.json({ error: 'No tenant for user' }, { status: 403 })
  }

  const { data, error } = await supabase
    .from('fundraise_rounds')
    .insert({ ...parsed.data, tenant_id: tenantId, status: parsed.data.status ?? 'planning' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}
