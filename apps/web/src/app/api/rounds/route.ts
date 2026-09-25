import { NextResponse } from 'next/server'
import { z } from 'zod'
import { SoTienDuong } from '@/lib/tien/so-tien'
import { createServerClient } from '@/lib/supabase/server'
import { getCurrentTenantId } from '@/lib/api/tenant'
import { safeString } from '@/lib/security/schemas'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * ⚠ Chép ĐÚNG ràng buộc `fundraise_rounds_status_check` của CSDL. Bản cũ dùng
 * 'dd' và 'closing' — hai giá trị CSDL từ chối — trong khi 'negotiating',
 * 'due_diligence', 'signed', 'wired', 'failed' thì không cách nào đặt được.
 */
const STATUSES = [
  'planning', 'outreach', 'negotiating', 'term_sheet',
  'due_diligence', 'signed', 'wired', 'closed', 'failed',
] as const

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
/**
 * Mã vòng — chép ĐÚNG ràng buộc `fundraise_rounds_round_code_check` của CSDL.
 *
 * Trước đây trường này là chuỗi tự do (`safeString.min(1)`) trong khi CSDL chỉ
 * nhận 10 giá trị: gõ "Series A" hay "seri_a" là nhận lỗi 500 khó hiểu từ
 * ràng buộc, thay vì một câu báo lỗi nói rõ chọn gì.
 *
 * ⚠ Bộ canh lệch lược đồ (`schema-khop-ma.test.ts` test 5) chỉ soi `z.enum`,
 * nên KHÔNG bắt được trường hợp chuỗi-tự-do-vào-cột-có-CHECK như thế này.
 */
const ROUND_CODES = [
  'pre_seed', 'seed', 'angel', 'series_a', 'series_b',
  'series_c', 'series_d', 'bridge', 'pre_ipo', 'ipo',
] as const

const CreateSchema = z.object({
  round_name: safeString.min(1),
  round_code: z.enum(ROUND_CODES),
  target_raise_usd: SoTienDuong,
  pre_money_usd: SoTienDuong.optional(),
  status: z.enum(STATUSES).optional(),
  /** Ngày dự kiến chốt vòng, dạng YYYY-MM-DD. */
  target_close_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày dạng YYYY-MM-DD').optional(),
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
