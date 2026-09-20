import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase/server'
import { requireUserAndTenant } from '@/lib/api/tenant'
import { SoTien, SoTienKhongAm } from '@/lib/tien/so-tien'
import { safeString, safeUuid } from '@/lib/security/schemas'
import { kiemBanNhap } from '@/lib/plan/gac-ban-nhap'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * DÒNG KẾ HOẠCH — doanh thu, chi phí, và mua sắm tài sản.
 *
 * ── VÌ SAO TỆP NÀY PHẢI TỒN TẠI ──
 * `plan_lines` trước đây CHỈ được ghi ở đúng một chỗ: khi sao chép từ một bản
 * kế hoạch cũ (`/api/plan` POST với `clone_from`). Không có bản cũ nào để sao
 * chép, nên tạo bản kế hoạch mới xong là engine trả lỗi "Kế hoạch chưa có
 * dòng nào". Đó là lý do trên production `plan_versions` = 0 và toàn bộ engine
 * tài chính — cùng hợp đồng ba tầng gửi ZeniOS/ZeniERP — chưa chạy thật lần nào.
 *
 * ── KIỂM TRA ĐỘNG LỰC THEO ĐÚNG KIỂU ──
 * `driver_config` là jsonb nên CSDL không kiểm được nội dung. Nếu cửa vào cũng
 * không kiểm thì một dòng `price_volume` thiếu `price_vnd` sẽ lọt xuống engine
 * và ra NaN — mà NaN lan qua mọi phép cộng rồi mới nổ ở bất biến cuối cùng,
 * lúc đó không còn biết dòng nào gây ra. Mỗi kiểu một lược đồ riêng, kiểm tại đây.
 *
 * ⚠ BẢN KẾ HOẠCH ĐÃ CHỐT THÌ KHÔNG SỬA. `plan_versions.status='published'` là
 * bất biến (ràng buộc #3 masterspec): muốn đổi thì tạo bản mới, bản cũ giữ
 * vĩnh viễn để nhà đầu tư soi "hứa vs làm".
 */

/** Khớp ĐÚNG union `Driver` của engine — lệch một trường là engine ra NaN. */
const DriverSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('price_volume'),
    price_vnd: SoTienKhongAm,
    volume_month1: z.number().min(0).max(1e9),
    growth_pct_m: z.number().min(-100).max(100),
  }),
  z.object({
    type: z.literal('saas_mrr'),
    mrr_month1_vnd: SoTienKhongAm,
    new_rate_pct: z.number().min(0).max(100),
    churn_rate_pct: z.number().min(0).max(100),
  }),
  z.object({ type: z.literal('pct_of_revenue'), pct: z.number().min(0).max(100) }),
  z.object({
    type: z.literal('headcount'),
    headcount_month1: z.number().int().min(0).max(100000),
    salary_vnd: SoTienKhongAm,
    insurance_pct: z.number().min(0).max(100),
    hires_per_month: z.number().min(0).max(10000).optional(),
  }),
  z.object({
    type: z.literal('cac_driven'),
    cac_vnd: SoTienKhongAm,
    new_customers_month1: z.number().min(0).max(1e9),
    growth_pct_m: z.number().min(-100).max(100),
  }),
  z.object({
    type: z.literal('fixed_schedule'),
    monthly_vnd: SoTien,
    growth_pct_m: z.number().min(-100).max(100).optional(),
  }),
  z.object({ type: z.literal('manual'), amounts_vnd: z.array(SoTien).min(1).max(60) }),
])

const CreateSchema = z.object({
  plan_version_id: safeUuid,
  /** Mã COA VAS — phải có trong `plan_coa_lines` (khoá ngoại ở CSDL). */
  coa_line: safeString.min(2).max(10),
  label_vi: safeString.min(1).max(200),
  company_id: safeUuid.nullable().optional(),
  driver: DriverSchema,
})

export async function POST(req: Request) {
  const supabase = await createServerClient()
  const auth = await requireUserAndTenant(supabase)
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status })

  const parsed = CreateSchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const gac = await kiemBanNhap(supabase, parsed.data.plan_version_id)
  if (!gac.ok) return NextResponse.json({ error: gac.message }, { status: gac.status })

  const { type, ...cauHinh } = parsed.data.driver
  const { data, error } = await supabase
    .from('plan_lines')
    .insert({
      tenant_id: auth.tenantId,
      plan_version_id: parsed.data.plan_version_id,
      company_id: parsed.data.company_id ?? null,
      coa_line: parsed.data.coa_line,
      label_vi: parsed.data.label_vi,
      driver_type: type,
      driver_config: cauHinh,
    })
    .select('id, coa_line, label_vi, driver_type, driver_config')
    .single()

  if (error) {
    // Khoá ngoại trỏ `plan_coa_lines` — mã lạ thì nói rõ thay vì ném lỗi CSDL.
    if (error.code === '23503') {
      return NextResponse.json(
        { error: `Mã COA "${parsed.data.coa_line}" không có trong danh mục tài khoản. Chọn mã từ danh sách.` },
        { status: 422 },
      )
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ data }, { status: 201 })
}

const UpdateSchema = z.object({
  id: safeUuid,
  label_vi: safeString.min(1).max(200).optional(),
  driver: DriverSchema.optional(),
})

export async function PATCH(req: Request) {
  const supabase = await createServerClient()
  const auth = await requireUserAndTenant(supabase)
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status })

  const parsed = UpdateSchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { data: dong } = await supabase
    .from('plan_lines')
    .select('id, plan_version_id')
    .eq('id', parsed.data.id)
    .maybeSingle()
  if (!dong) return NextResponse.json({ error: 'Không tìm thấy dòng kế hoạch' }, { status: 404 })

  const gac = await kiemBanNhap(supabase, String(dong.plan_version_id))
  if (!gac.ok) return NextResponse.json({ error: gac.message }, { status: gac.status })

  const capNhat: Record<string, unknown> = {}
  if (parsed.data.label_vi !== undefined) capNhat.label_vi = parsed.data.label_vi
  if (parsed.data.driver) {
    const { type, ...cauHinh } = parsed.data.driver
    capNhat.driver_type = type
    capNhat.driver_config = cauHinh
  }
  if (Object.keys(capNhat).length === 0) {
    return NextResponse.json({ error: 'Không có trường nào để cập nhật' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('plan_lines')
    .update(capNhat)
    .eq('id', parsed.data.id)
    .select('id, coa_line, label_vi, driver_type, driver_config')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function DELETE(req: Request) {
  const supabase = await createServerClient()
  const auth = await requireUserAndTenant(supabase)
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status })

  const id = new URL(req.url).searchParams.get('id') ?? ''
  if (!safeUuid.safeParse(id).success) {
    return NextResponse.json({ error: 'Thiếu hoặc sai tham số id' }, { status: 400 })
  }

  const { data: dong } = await supabase
    .from('plan_lines')
    .select('id, plan_version_id')
    .eq('id', id)
    .maybeSingle()
  if (!dong) return NextResponse.json({ error: 'Không tìm thấy dòng kế hoạch' }, { status: 404 })

  const gac = await kiemBanNhap(supabase, String(dong.plan_version_id))
  if (!gac.ok) return NextResponse.json({ error: gac.message }, { status: gac.status })

  const { error } = await supabase.from('plan_lines').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data: { id } })
}
