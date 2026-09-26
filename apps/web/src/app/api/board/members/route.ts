import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase/server'
import { requireUserAndTenant } from '@/lib/api/tenant'
import { safeString, safeUuid } from '@/lib/security/schemas'
import { LOAI_THANH_VIEN, TRANG_THAI_THANH_VIEN } from '@/lib/zeni/vai'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * THÀNH VIÊN HỘI ĐỒNG QUẢN TRỊ.
 *
 * Điểm sẵn sàng niêm yết đang chấm tiêu chí `board_composition` (≥3 thành viên
 * độc lập) và `audit_committee`. Trước migration 048 không có bảng nào lưu
 * thành viên, nên hai tiêu chí ấy chỉ có thể "chứng minh" bằng cách tải lên một
 * tệp PDF rồi tin nhau.
 *
 * ⚠ TÍNH ĐỘC LẬP PHẢI CÓ CĂN CỨ. `co_so_doc_lap` rỗng thì
 * `dem_thanh_vien_doc_lap()` KHÔNG đếm, dù `member_type` ghi `doc_lap`. Đây là
 * cùng một luật với điểm sẵn sàng (038): tự khai không phải bằng chứng.
 */

const TaoSchema = z.object({
  full_name: safeString.min(2).max(120),
  email: z.string().email().max(160).optional(),
  title_vi: safeString.max(120).optional(),
  member_type: z.enum(LOAI_THANH_VIEN),
  is_chairman: z.boolean().optional(),
  is_financial_expert: z.boolean().optional(),
  shareholding_pct: z.number().min(0).max(100).optional(),
  /** Căn cứ tính độc lập — pháp chế điền. Không có thì không được đếm. */
  co_so_doc_lap: z.record(z.string(), z.unknown()).optional(),
  term_start: z.string().date().optional(),
  term_end: z.string().date().optional(),
  user_id: safeUuid.optional(),
})

const SuaSchema = TaoSchema.partial().extend({
  id: safeUuid,
  status: z.enum(TRANG_THAI_THANH_VIEN).optional(),
})

export async function GET() {
  const supabase = await createServerClient()
  const auth = await requireUserAndTenant(supabase)
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status })

  const { data, error } = await supabase
    .from('board_members')
    .select('*')
    .eq('tenant_id', auth.tenantId)
    .order('is_chairman', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: dem, error: loiDem } = await supabase.rpc('dem_thanh_vien_doc_lap', {
    p_tenant: auth.tenantId,
  })

  return NextResponse.json({
    data,
    thong_ke: dem ?? null,
    // Không nuốt lỗi: nếu đếm được thì trả số, không thì nói rõ là chưa đếm được.
    loi_thong_ke: loiDem?.message ?? null,
  })
}

export async function POST(req: Request) {
  const parsed = TaoSchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const supabase = await createServerClient()
  const auth = await requireUserAndTenant(supabase)
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status })

  const { data, error } = await supabase
    .from('board_members')
    .insert({ ...parsed.data, tenant_id: auth.tenantId })
    .select()
    .single()
  if (error) {
    // Chỉ một chủ tịch đang tại vị — chỉ mục uq_board_one_chairman canh việc đó.
    const trung = error.message.includes('uq_board_one_chairman')
    return NextResponse.json(
      {
        error: trung
          ? 'Doanh nghiệp đã có chủ tịch đang tại vị. Miễn nhiệm người cũ trước khi bổ nhiệm người mới.'
          : error.message,
      },
      { status: trung ? 409 : 500 },
    )
  }
  return NextResponse.json({ data }, { status: 201 })
}

export async function PATCH(req: Request) {
  const parsed = SuaSchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const supabase = await createServerClient()
  const auth = await requireUserAndTenant(supabase)
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status })

  const { id, ...thayDoi } = parsed.data
  if (Object.keys(thayDoi).length === 0) {
    return NextResponse.json({ error: 'Không có trường nào để sửa' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('board_members')
    .update({ ...thayDoi, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('tenant_id', auth.tenantId)
    .select()
    .maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Không tìm thấy thành viên' }, { status: 404 })
  return NextResponse.json({ data })
}
