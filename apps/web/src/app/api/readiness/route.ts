import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { safeUuid } from '@/lib/security/schemas'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: Request) {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  let journeyId = searchParams.get('journey_id')

  // Không truyền hành trình thì lấy hành trình ĐANG HOẠT ĐỘNG của người dùng.
  //
  // ⚠ Bản trước bắt buộc `journey_id`, trong khi bộ đấu dữ liệu của trang
  // `/compliance` gọi `/api/readiness` TRẦN, không tham số. Đo trên production:
  // endpoint luôn trả 400, nên trang tuân thủ luôn hiện "chưa đo được (mã 400)".
  // Một doanh nghiệp chỉ có một hành trình đang chạy — bắt giao diện phải tự
  // biết mã của nó là đẩy việc sang phía không có thông tin.
  if (!journeyId) {
    const { data: hanhTrinh } = await supabase
      .from('ipo_journeys')
      .select('id')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    journeyId = (hanhTrinh as { id?: string } | null)?.id ?? null
    if (!journeyId) {
      // Chưa khởi tạo hành trình ⇒ trả RỖNG kèm lý do, không phải lỗi 400.
      // Đây là trạng thái hợp lệ của khách mới, không phải sai sót của họ.
      return NextResponse.json({
        data: {
          criteria: [],
          history: [],
          score: null,
          ghi_chu: 'Chưa có hành trình IPO nào đang hoạt động — hoàn tất bước nhập môn để hệ thống tạo bộ tiêu chí chuẩn.',
        },
      })
    }
  } else if (!safeUuid.safeParse(journeyId).success) {
    return NextResponse.json({ error: 'journey_id không hợp lệ' }, { status: 400 })
  }

  const [criteria, history, score] = await Promise.all([
    supabase
      .from('ipo_readiness_criteria')
      .select('*')
      .eq('journey_id', journeyId)
      .order('category', { ascending: true }),
    supabase
      .from('readiness_score_history')
      .select('*')
      .eq('journey_id', journeyId)
      .order('captured_at', { ascending: true }),
    supabase.rpc('compute_readiness_score', { journey_id: journeyId }),
  ])

  if (criteria.error) {
    return NextResponse.json({ error: criteria.error.message }, { status: 500 })
  }

  return NextResponse.json({
    data: {
      criteria: criteria.data ?? [],
      history: history.data ?? [],
      score: score.data ?? null,
    },
  })
}
