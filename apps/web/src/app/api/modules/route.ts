import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { getCurrentTenantId } from '@/lib/api/tenant'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * DANH MỤC MÔ-ĐUN — 32 mô-đun, mỗi cái có `min_tier` từ lâu mà chưa ai đọc.
 *
 * Bản cũ ghi thẳng trong mã "Public read — no auth required" và trả về TẤT CẢ
 * mô-đun đang bật, không lọc theo gói. Tức cột `min_tier` khai gói tối thiểu
 * cho từng mô-đun nhưng không hề có tác dụng.
 *
 * ── HIỆN MÔ-ĐUN BỊ KHOÁ, ĐỪNG GIẤU ĐI ──
 * Lọc bỏ hẳn mô-đun chưa đủ gói thì khách không bao giờ biết mình đang bỏ lỡ
 * gì, và cũng không có lý do nâng gói. Trả về đủ 32 mô-đun kèm cờ `mo_khoa`
 * và gói cần nâng — giao diện hiện ổ khoá chứ không hiện danh sách cụt.
 *
 * Chưa đăng nhập vẫn đọc được (đây là danh mục sản phẩm, không phải dữ liệu
 * doanh nghiệp) nhưng khi đó chỉ mô-đun gói miễn phí là mở.
 */

/** Thứ hạng gói lấy từ `display_order` — free 0 < explorer 1 < … < enterprise 4. */
type Tier = { tier_code: string; display_order: number; name_vi: string }

export async function GET() {
  const supabase = await createServerClient()

  const [modulesR, tiersR] = await Promise.all([
    supabase
      .from('modules_catalog')
      .select('*')
      .eq('is_enabled', true)
      .order('display_order', { ascending: true }),
    supabase.from('membership_tiers').select('tier_code, display_order, name_vi'),
  ])
  if (modulesR.error) return NextResponse.json({ error: modulesR.error.message }, { status: 500 })

  const tiers = (tiersR.data ?? []) as Tier[]
  const hang = new Map(tiers.map((t) => [t.tier_code, t.display_order]))
  const tenTheoMa = new Map(tiers.map((t) => [t.tier_code, t.name_vi]))

  // Gói hiện tại — chưa đăng nhập thì coi như 'free'.
  let goiHienTai = 'free'
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (user) {
    const tenantId = await getCurrentTenantId(supabase, user.id)
    if (tenantId) {
      const { data } = await supabase.rpc('goi_hien_tai', { p_tenant: tenantId })
      if (typeof data === 'string') goiHienTai = data
    }
  }
  const hangHienTai = hang.get(goiHienTai) ?? 0

  const data = (modulesR.data ?? []).map((m) => {
    const canHang = hang.get(String(m.min_tier)) ?? 0
    const moKhoa = hangHienTai >= canHang
    return {
      ...m,
      mo_khoa: moKhoa,
      // Nói rõ cần gói nào, không bắt khách tự tra bảng giá.
      can_goi: moKhoa ? null : String(m.min_tier),
      can_goi_ten: moKhoa ? null : (tenTheoMa.get(String(m.min_tier)) ?? String(m.min_tier)),
    }
  })

  return NextResponse.json({
    data,
    goi_hien_tai: goiHienTai,
    so_mo_khoa: data.filter((m) => m.mo_khoa).length,
    tong: data.length,
  })
}
