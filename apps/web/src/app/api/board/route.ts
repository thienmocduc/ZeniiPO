import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { requireUserAndTenant } from '@/lib/api/tenant'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * TỔNG HỢP QUẢN TRỊ — số liệu thật cho bảng điều khiển hội đồng.
 *
 * ⚠ BẢN TRƯỚC TRẢ VỀ SAI ĐỐI TƯỢNG. Nó đọc `user_profiles` với
 * `role IN ('chr','ceo','board','investor')` rồi gọi đó là hội đồng quản trị.
 * Hai vấn đề:
 *   1. `board` và `investor` KHÔNG phải vai hợp lệ — ràng buộc CHECK của
 *      `user_profiles.role` chỉ nhận chr·ceo·cfo·coo·cto·cmo·clo·cro·cpo·chro·
 *      ciso·gov·emp. Hai giá trị đó không khớp dòng nào, nên phần "investor" và
 *      "thành viên độc lập" LUÔN bằng 0 dù doanh nghiệp có bao nhiêu người.
 *   2. Hội đồng quản trị KHÔNG PHẢI tập người dùng nền tảng. Thành viên độc lập
 *      thường là người ngoài, không có tài khoản. Suy hội đồng từ danh sách tài
 *      khoản là sai từ gốc, không phải sai công thức.
 *
 * Nay đọc đúng `board_members` (migration 048) và đếm thành viên độc lập bằng
 * `dem_thanh_vien_doc_lap()` — hàm chỉ tính người CÓ CĂN CỨ độc lập.
 */

export async function GET() {
  const supabase = await createServerClient()
  const auth = await requireUserAndTenant(supabase)
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status })

  const namNay = new Date().getFullYear()
  const dauNam = `${namNay}-01-01`

  const [thanhVien, uyBan, kyHop, nghiQuyet, dem] = await Promise.all([
    supabase
      .from('board_members')
      .select('id, full_name, title_vi, member_type, is_chairman, is_financial_expert, co_so_doc_lap, status')
      .eq('tenant_id', auth.tenantId)
      .eq('status', 'active')
      .order('is_chairman', { ascending: false }),
    supabase
      .from('board_committees')
      .select('id, committee_code, name_vi')
      .eq('tenant_id', auth.tenantId)
      .eq('status', 'active'),
    supabase
      .from('board_meetings')
      .select('id, meeting_no, title, meeting_type, scheduled_at, status')
      .eq('tenant_id', auth.tenantId)
      .order('scheduled_at', { ascending: true }),
    supabase
      .from('board_resolutions')
      .select('id, resolution_no, title, meeting_date, resolution_type, status, votes_for, votes_against')
      .eq('tenant_id', auth.tenantId)
      .order('meeting_date', { ascending: false }),
    supabase.rpc('dem_thanh_vien_doc_lap', { p_tenant: auth.tenantId }),
  ])

  const loi = thanhVien.error ?? kyHop.error ?? nghiQuyet.error
  if (loi) return NextResponse.json({ error: loi.message }, { status: 500 })

  type KH = { scheduled_at: string; status: string }
  type NQ = { meeting_date: string; status: string }
  const dsKyHop = (kyHop.data ?? []) as KH[]
  const dsNq = (nghiQuyet.data ?? []) as NQ[]
  const bayGio = Date.now()

  const sapToi = dsKyHop
    .filter((k) => k.status !== 'huy' && new Date(k.scheduled_at).getTime() >= bayGio)
    .sort((a, b) => +new Date(a.scheduled_at) - +new Date(b.scheduled_at))[0]

  return NextResponse.json({
    data: thanhVien.data ?? [],
    uy_ban: uyBan.data ?? [],
    ky_hop: kyHop.data ?? [],
    nghi_quyet: nghiQuyet.data ?? [],
    tong_hop: {
      // Con số này là con số thẩm định viên đọc: chỉ thành viên CÓ CĂN CỨ độc lập.
      ...((dem.data as Record<string, unknown> | null) ?? {}),
      so_uy_ban: (uyBan.data ?? []).length,
      co_uy_ban_kiem_toan: (uyBan.data ?? []).some(
        (u) => (u as { committee_code: string }).committee_code === 'audit',
      ),
      hop_trong_nam: dsKyHop.filter(
        (k) => k.scheduled_at >= dauNam && k.status === 'da_hop',
      ).length,
      nghi_quyet_trong_nam: dsNq.filter((r) => r.meeting_date >= dauNam).length,
      nghi_quyet_da_thong_qua: dsNq.filter(
        (r) => r.status === 'approved' || r.status === 'executed',
      ).length,
      ky_hop_sap_toi: sapToi?.scheduled_at ?? null,
    },
  })
}
