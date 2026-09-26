import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase/server'
import { requireUserAndTenant } from '@/lib/api/tenant'
import { safeString, safeUuid } from '@/lib/security/schemas'
import { MA_UY_BAN, VAI_UY_BAN } from '@/lib/zeni/vai'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * UỶ BAN TRỰC THUỘC HỘI ĐỒNG — kiểm toán · lương thưởng · nhân sự · rủi ro.
 *
 * Uỷ ban kiểm toán là tiêu chí `audit_committee` đang được chấm trong điểm sẵn
 * sàng niêm yết. Ở đây trả kèm hai con số mà thẩm định viên hỏi đầu tiên:
 * uỷ ban có bao nhiêu thành viên **độc lập**, và có ai đọc được báo cáo tài
 * chính ở mức chuyên môn (`is_financial_expert`) hay không. Một uỷ ban kiểm
 * toán không có người nào như vậy thì về hình thức là có, về thực chất là không.
 */

const TaoSchema = z.object({
  committee_code: z.enum(MA_UY_BAN),
  name_vi: safeString.min(2).max(160),
  charter_doc_id: safeUuid.optional(),
  established_resolution_id: safeUuid.optional(),
  established_date: z.string().date().optional(),
})

const ThanhVienSchema = z.object({
  committee_id: safeUuid,
  member_id: safeUuid,
  vai: z.enum(VAI_UY_BAN).default('member'),
  from_date: z.string().date().optional(),
})

export async function GET() {
  const supabase = await createServerClient()
  const auth = await requireUserAndTenant(supabase)
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status })

  const { data, error } = await supabase
    .from('board_committees')
    .select('*')
    .eq('tenant_id', auth.tenantId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const ubs = (data ?? []) as Array<{ id: string; committee_code: string }>
  if (ubs.length === 0) {
    return NextResponse.json({
      data: [],
      ghi_chu:
        'Chưa lập uỷ ban nào. Tiêu chí "Đã lập uỷ ban kiểm toán" trong điểm sẵn sàng niêm yết sẽ không đạt.',
    })
  }

  // Thành viên từng uỷ ban, kèm tính độc lập và chuyên môn tài chính lấy từ
  // `board_members` — không nhân bản hai cờ đó sang bảng thành viên uỷ ban.
  const { data: tv } = await supabase
    .from('board_committee_members')
    .select('id, committee_id, member_id, vai, from_date, to_date')
    .in('committee_id', ubs.map((u) => u.id))

  const { data: bm } = await supabase
    .from('board_members')
    .select('id, full_name, member_type, is_financial_expert, co_so_doc_lap, status')
    .eq('tenant_id', auth.tenantId)

  type TV = { committee_id: string; member_id: string; vai: string; to_date: string | null }
  type BM = {
    id: string
    full_name: string
    member_type: string
    is_financial_expert: boolean
    co_so_doc_lap: unknown
    status: string
  }
  const theoId = new Map((bm ?? []).map((m) => [(m as BM).id, m as BM]))

  const chiTiet = ubs.map((u) => {
    const dsTv = ((tv ?? []) as TV[]).filter((x) => x.committee_id === u.id && x.to_date === null)
    const nguoi = dsTv.map((x) => theoId.get(x.member_id)).filter((x): x is BM => Boolean(x))
    const coCanCu = (m: BM) =>
      m.member_type === 'doc_lap' && m.co_so_doc_lap != null && Object.keys(m.co_so_doc_lap as object).length > 0
    return {
      ...u,
      so_thanh_vien: nguoi.length,
      so_doc_lap_co_can_cu: nguoi.filter(coCanCu).length,
      co_chuyen_gia_tai_chinh: nguoi.some((m) => m.is_financial_expert),
      thanh_vien: dsTv.map((x) => ({
        ...x,
        ho_ten: theoId.get(x.member_id)?.full_name ?? null,
      })),
      canh_bao:
        u.committee_code === 'audit' && !nguoi.some((m) => m.is_financial_expert)
          ? 'Uỷ ban kiểm toán chưa có thành viên nào được đánh dấu là chuyên gia tài chính.'
          : null,
    }
  })

  return NextResponse.json({ data: chiTiet })
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))

  // Một cửa vào cho hai việc: lập uỷ ban, và thêm người vào uỷ ban. Phân biệt
  // bằng chính hình dạng dữ liệu gửi lên.
  if (typeof body === 'object' && body !== null && 'member_id' in body) {
    const parsed = ThanhVienSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

    const supabase = await createServerClient()
    const auth = await requireUserAndTenant(supabase)
    if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status })

    // Kiểm cả uỷ ban và thành viên đều thuộc doanh nghiệp này. RLS đã canh,
    // nhưng kiểm ở đây để trả 404 đọc được thay vì lỗi ràng buộc thô.
    const [{ data: ub }, { data: tv }] = await Promise.all([
      supabase.from('board_committees').select('id').eq('id', parsed.data.committee_id)
        .eq('tenant_id', auth.tenantId).maybeSingle(),
      supabase.from('board_members').select('id').eq('id', parsed.data.member_id)
        .eq('tenant_id', auth.tenantId).maybeSingle(),
    ])
    if (!ub) return NextResponse.json({ error: 'Không tìm thấy uỷ ban' }, { status: 404 })
    if (!tv) return NextResponse.json({ error: 'Không tìm thấy thành viên hội đồng' }, { status: 404 })

    const { data, error } = await supabase
      .from('board_committee_members')
      .insert(parsed.data)
      .select()
      .single()
    if (error) {
      const trung = error.message.includes('uq_committee_member')
      return NextResponse.json(
        { error: trung ? 'Thành viên này đã ở trong uỷ ban' : error.message },
        { status: trung ? 409 : 500 },
      )
    }
    return NextResponse.json({ data }, { status: 201 })
  }

  const parsed = TaoSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const supabase = await createServerClient()
  const auth = await requireUserAndTenant(supabase)
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status })

  const { data, error } = await supabase
    .from('board_committees')
    .insert({ ...parsed.data, tenant_id: auth.tenantId })
    .select()
    .single()
  if (error) {
    const trung = error.message.includes('uq_committee_per_tenant')
    return NextResponse.json(
      { error: trung ? 'Doanh nghiệp đã có uỷ ban loại này đang hoạt động' : error.message },
      { status: trung ? 409 : 500 },
    )
  }
  return NextResponse.json({ data }, { status: 201 })
}
