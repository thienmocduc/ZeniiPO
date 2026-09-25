import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { requireUserAndTenant } from '@/lib/api/tenant'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  const supabase = await createServerClient()
  const auth = await requireUserAndTenant(supabase)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status })
  }
  const [tiers, sub, hanMuc] = await Promise.all([
    supabase.from('membership_tiers').select('*').order('price_usd_month', { ascending: true }),
    supabase
      .from('subscriptions')
      .select('*')
      .eq('tenant_id', auth.tenantId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    // Hạn mức + mức đã dùng, tính ở CSDL để giao diện và cửa vào API dùng
    // CHUNG một định nghĩa (migration 044).
    supabase.rpc('han_muc_goi', { p_tenant: auth.tenantId }),
  ])
  if (tiers.error) return NextResponse.json({ error: tiers.error.message }, { status: 500 })

  const hm = (Array.isArray(hanMuc.data) ? hanMuc.data[0] : hanMuc.data) ?? null

  return NextResponse.json({
    data: {
      tiers: tiers.data ?? [],
      current_subscription: sub.data,
      han_muc: hm,
      // Nói thẳng tình trạng cổng thanh toán thay vì hiện một nút mua không
      // bấm được. Mã cũ viết theo Stripe trực tiếp — trái quy tắc chỉ dùng
      // Zeni Cloud; đường đúng là connector VNPay/MoMo/ZaloPay của ZeniCloud,
      // chưa nối vì còn chờ chọn cổng và thông tin đơn vị bán.
      thanh_toan: {
        san_sang: false,
        ghi_chu:
          'Cổng thanh toán trực tuyến chưa mở. Liên hệ để được cấp gói — ' +
          'hệ thống ghi rõ đây là cấp tay, không tính vào doanh thu.',
      },
    },
  })
}
