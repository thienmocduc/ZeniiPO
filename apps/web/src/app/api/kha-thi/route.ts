import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { requireUserAndTenant } from '@/lib/api/tenant'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * CỔNG KHẢ THI CHIẾN LƯỢC.
 *
 * Trang Sao Bắc Đẩu hứa nguyên văn: *"Zeniipo reverse-engineer ra công thức
 * ràng buộc mọi metric suốt 60 tháng tiếp theo"*. Trước endpoint này, lời hứa đó
 * không có một dòng mã nào phía sau: `cascade_chairman_event` nhận định giá mục
 * tiêu rồi ghi thẳng xuống, không một phép thử nào.
 *
 * `kiem_kha_thi_chien_luoc()` (migration 050) giải ngược định giá → doanh thu
 * cần → nhịp tăng trưởng cần, rồi so với nhịp trong bản kế hoạch ĐÃ CHỐT.
 *
 * ⚠ Nó KHÔNG phán "khả thi/bất khả thi" theo ngưỡng tự đặt. Nó phát biểu một
 * sự thật số học: mục tiêu đòi gấp bao nhiêu lần chính cam kết trong kế hoạch
 * của doanh nghiệp. Thiếu tỷ giá hoặc bội số ngành thì trả `chua_do_duoc` kèm
 * tên bảng còn trống — không đoán, vì đoán một lần là mất hết giá trị của cổng.
 */

export async function GET(req: Request) {
  const supabase = await createServerClient()
  const auth = await requireUserAndTenant(supabase)
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status })

  let journeyId = new URL(req.url).searchParams.get('journey_id')

  // Mặc định lấy hành trình đang chạy. Bắt giao diện phải biết mã hành trình là
  // lý do `/api/readiness` từng luôn trả 400 — cùng lỗi, không lặp lại.
  if (!journeyId) {
    const { data } = await supabase
      .from('ipo_journeys')
      .select('id')
      .eq('tenant_id', auth.tenantId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
    journeyId = ((data?.[0] as { id?: string } | undefined)?.id) ?? null
  }

  if (!journeyId) {
    return NextResponse.json({
      data: {
        ket_luan: 'chua_do_duoc',
        giai_thich:
          'Doanh nghiệp chưa có hành trình nào đang chạy — chưa có mục tiêu nào để kiểm. ' +
          'Hoàn thành bước nhập môn trước.',
        thieu: ['ipo_journeys: chưa có hành trình đang chạy'],
      },
    })
  }

  const { data, error } = await supabase.rpc('kiem_kha_thi_chien_luoc', { p_journey: journeyId })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data, journey_id: journeyId })
}
