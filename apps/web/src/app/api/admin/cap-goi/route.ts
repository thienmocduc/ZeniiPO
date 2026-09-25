import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/service'
import { isCurrentSuperAdmin } from '@/lib/zeni/superadmin'
import { safeString, safeUuid } from '@/lib/security/schemas'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * CẤP GÓI CHO KHÁCH THÍ ĐIỂM — không qua thanh toán.
 *
 * Cổng thanh toán trực tuyến chưa nối (còn chờ chọn VNPay/MoMo/ZaloPay và
 * thông tin đơn vị bán). Nhưng khách thí điểm và đối tác thì phải vào dùng
 * được ngay — nếu không, tầng khoá tính năng vừa dựng lại thành cái khoá chặn
 * chính khách hàng đầu tiên.
 *
 * ⚠ GHI NHÃN NGUỒN, KHÔNG GIẢ VỜ ĐÃ THANH TOÁN. Bản ghi đăng ký sinh ra ở đây
 * mang nhãn `cap-tay:<lý do>`. Doanh thu và quà tặng phải tách được nhau —
 * lẫn vào nhau thì báo cáo doanh thu thành số bịa, và đó đúng là loại số mà
 * nhà đầu tư soi kỹ nhất.
 *
 * ⚠ CHỈ CHỦ TỊCH NỀN TẢNG. Kiểm hai lớp: ở đây bằng `isCurrentSuperAdmin()`,
 * và một lần nữa trong hàm `cap_goi()` ở CSDL. Hai lớp vì đây là đường cấp
 * quyền dùng miễn phí — đi lọt là mất doanh thu thật.
 */

const Body = z.object({
  tenant_id: safeUuid,
  tier_code: z.enum(['free', 'explorer', 'pro', 'elite', 'enterprise']),
  so_thang: z.number().int().min(1).max(120).default(12),
  ly_do: safeString.min(3).max(200),
})

export async function POST(req: Request) {
  if (!(await isCurrentSuperAdmin())) {
    return NextResponse.json(
      { error: 'Chỉ chủ tịch nền tảng mới cấp gói không qua thanh toán được.' },
      { status: 403 },
    )
  }

  const parsed = Body.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const sb = createServiceClient()

  const { data: tenant } = await sb
    .from('tenants')
    .select('id, name, slug')
    .eq('id', parsed.data.tenant_id)
    .maybeSingle()
  if (!tenant) return NextResponse.json({ error: 'Không tìm thấy doanh nghiệp' }, { status: 404 })

  const { data, error } = await sb.rpc('cap_goi', {
    p_tenant: parsed.data.tenant_id,
    p_tier: parsed.data.tier_code,
    p_so_thang: parsed.data.so_thang,
    p_ly_do: parsed.data.ly_do,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    data: {
      ...(data as Record<string, unknown>),
      doanh_nghiep: tenant.name,
      ghi_chu_he_thong:
        'Đây là cấp tay, KHÔNG phải doanh thu. Nhãn nguồn nằm ở subscriptions.stripe_customer_id.',
    },
  })
}

/** GET — xem những gói đã cấp tay, để đối chiếu khi chốt doanh thu. */
export async function GET() {
  if (!(await isCurrentSuperAdmin())) {
    return NextResponse.json({ error: 'Chỉ chủ tịch nền tảng' }, { status: 403 })
  }
  const sb = createServiceClient()
  const { data, error } = await sb
    .from('subscriptions')
    .select('tenant_id, tier_code, status, current_period_start, current_period_end, stripe_customer_id')
    .order('current_period_start', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const ds = (data ?? []) as Array<Record<string, unknown>>
  const capTay = ds.filter((x) => String(x.stripe_customer_id ?? '').startsWith('cap-tay:'))
  return NextResponse.json({
    data: {
      tong: ds.length,
      cap_tay: capTay.length,
      tra_phi_that: ds.length - capTay.length,
      danh_sach: ds,
    },
  })
}
