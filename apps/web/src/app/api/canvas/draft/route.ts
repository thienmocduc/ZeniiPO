import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { requireUserAndTenant } from '@/lib/api/tenant'
import { chatComplete, isAIConfigured, DEFAULT_MODEL } from '@/lib/agents/client'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 120

/**
 * POST /api/canvas/draft — AI soạn BẢN NHÁP mô hình kinh doanh 9 khối.
 *
 * Đây là bước 1 của hành trình Idea → IPO (`journey_phase_specs`.phase 1:
 * "Đóng khung mô hình kinh doanh — 9 khối BMC + phán quyết Council 9"), và
 * cũng là chỗ tự động hoá được nhiều nhất: người sáng lập thường tắc ở tờ
 * giấy trắng, không tắc ở việc sửa một bản nháp.
 *
 * ── BA LUẬT CỨNG ──
 *
 * 1. KHÔNG ĐÈ LÊN CÁI NGƯỜI ĐÃ VIẾT. Khối nào mang nhãn `nguon='nguoi'` thì
 *    bỏ qua, kể cả khi người dùng bấm soạn lại. Máy xoá mất một câu người
 *    sáng lập nghĩ cả tháng là lỗi không sửa được bằng nút hoàn tác.
 *
 * 2. MỌI KHỐI MÁY SOẠN ĐỀU MANG NHÃN. `nguon='ai'` + tên mô hình + thời điểm.
 *    Nhà đầu tư đọc mô hình kinh doanh sẽ hỏi "ai nghĩ ra cái này"; một bản
 *    do máy soạn mà người sáng lập chưa đọc lại thì không bảo vệ được trong
 *    phòng họp — mà nhìn trên màn hình lại giống hệt bản người viết.
 *
 * 3. KHÔNG CÓ AI THÌ NÓI THẲNG. Thiếu khoá thì trả 503 kèm lời giải thích,
 *    KHÔNG dựng sẵn vài câu mẫu rồi để người dùng tưởng máy đã nghĩ hộ.
 */

const KHOI = [
  { key: 'customer_segments', ten: 'Phân khúc khách hàng', hoi: 'Ai trả tiền, và họ khác nhau ở điểm nào?' },
  { key: 'value_propositions', ten: 'Giá trị mang lại', hoi: 'Giải quyết nỗi đau nào, hơn giải pháp hiện tại ở chỗ nào?' },
  { key: 'channels', ten: 'Kênh tiếp cận', hoi: 'Khách biết tới, mua, và được phục vụ qua đường nào?' },
  { key: 'customer_relationships', ten: 'Quan hệ khách hàng', hoi: 'Giữ chân bằng cách nào — tự phục vụ, tư vấn riêng, hay cộng đồng?' },
  { key: 'revenue_streams', ten: 'Dòng doanh thu', hoi: 'Thu tiền theo cách nào — bán đứt, thuê bao, hoa hồng, quảng cáo?' },
  { key: 'key_resources', ten: 'Nguồn lực chính', hoi: 'Không có thứ gì thì mô hình sụp?' },
  { key: 'key_activities', ten: 'Hoạt động chính', hoi: 'Việc gì làm mỗi ngày mới tạo ra giá trị đó?' },
  { key: 'key_partnerships', ten: 'Đối tác chính', hoi: 'Ai làm hộ phần mình không nên tự làm?' },
  { key: 'cost_structure', ten: 'Cơ cấu chi phí', hoi: 'Tiền đi đâu nhiều nhất, cố định hay biến đổi?' },
] as const

type KhoiKey = (typeof KHOI)[number]['key']

export async function POST(req: Request) {
  const supabase = await createServerClient()
  const auth = await requireUserAndTenant(supabase)
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status })

  if (!isAIConfigured()) {
    return NextResponse.json(
      {
        error:
          'Chưa cấu hình AI nên không soạn nháp được. Bạn vẫn tự điền 9 khối bình thường — ' +
          'hệ thống không dựng sẵn câu mẫu để tránh việc bạn tưởng máy đã nghĩ hộ.',
      },
      { status: 503 },
    )
  }

  // Bối cảnh doanh nghiệp — lấy từ hành trình đã khai lúc nhập môn.
  const { data: journey } = await supabase
    .from('ipo_journeys')
    .select('name, industry, north_star_metric, target_year, exit_venue')
    .eq('tenant_id', auth.tenantId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!journey) {
    return NextResponse.json(
      { error: 'Chưa có hành trình IPO nào. Hoàn tất bước nhập môn trước, vì bản nháp phải dựa trên ngành và mục tiêu thật của bạn.' },
      { status: 422 },
    )
  }

  // Khối nào NGƯỜI đã viết thì giữ nguyên tuyệt đối.
  const { data: dangCo } = await supabase
    .from('canvas_blocks')
    .select('block_key, items, nguon')
    .eq('tenant_id', auth.tenantId)

  const nguoiDaViet = new Set(
    (dangCo ?? [])
      .filter((b) => b.nguon === 'nguoi' && Array.isArray(b.items) && b.items.length > 0)
      .map((b) => b.block_key as string),
  )
  const canSoan = KHOI.filter((k) => !nguoiDaViet.has(k.key))
  if (canSoan.length === 0) {
    return NextResponse.json({
      data: { da_ghi: [], bo_qua: [...nguoiDaViet], ghi_chu: 'Cả 9 khối đều do bạn tự viết — máy không đè lên bất kỳ khối nào.' },
    })
  }

  const system =
    'Bạn là chuyên gia mô hình kinh doanh, dựng Business Model Canvas theo Osterwalder cho doanh nghiệp Việt Nam. ' +
    'Viết TIẾNG VIỆT, mỗi ý MỘT dòng ngắn gọn, cụ thể, có thể kiểm chứng — cấm nói chung chung kiểu "nâng cao trải nghiệm". ' +
    'Nếu không đủ căn cứ cho một khối thì trả mảng rỗng cho khối đó, KHÔNG bịa.'

  const user = [
    `DOANH NGHIỆP: ${journey.name}`,
    `NGÀNH: ${journey.industry || '(chưa khai)'}`,
    `CHỈ SỐ SAO BẮC ĐẨU: ${journey.north_star_metric || '(chưa khai)'}`,
    `MỤC TIÊU NIÊM YẾT: ${journey.exit_venue ?? '?'} năm ${journey.target_year ?? '?'}`,
    '',
    'Soạn các khối sau, mỗi khối 3–5 ý:',
    ...canSoan.map((k) => `- ${k.key} (${k.ten}): ${k.hoi}`),
    '',
    'Trả về DUY NHẤT một JSON dạng {"<block_key>": ["ý 1","ý 2",...]}, không kèm lời dẫn, không rào markdown.',
  ].join('\n')

  let r
  try {
    r = await chatComplete({ system, user, model: DEFAULT_MODEL, maxTokens: 2000 })
  } catch (e) {
    return NextResponse.json(
      { error: `Gọi AI thất bại: ${e instanceof Error ? e.message : 'lỗi không rõ'}` },
      { status: 502 },
    )
  }

  // Mô hình đôi khi bọc JSON trong rào markdown — gỡ trước khi đọc.
  const tho = r.text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  let ketQua: Record<string, unknown>
  try {
    ketQua = JSON.parse(tho) as Record<string, unknown>
  } catch {
    return NextResponse.json(
      { error: 'AI trả về không phải JSON đọc được. Không ghi gì cả — thà không có bản nháp còn hơn ghi dữ liệu hỏng.' },
      { status: 502 },
    )
  }

  const luc = new Date().toISOString()
  const dongGhi = canSoan
    .map((k) => {
      const raw = ketQua[k.key]
      const items = Array.isArray(raw)
        ? raw.filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
            .map((x) => x.trim().slice(0, 300))
            .slice(0, 20)
        : []
      return { k: k.key as KhoiKey, items }
    })
    .filter((x) => x.items.length > 0)

  if (dongGhi.length === 0) {
    return NextResponse.json(
      { error: 'AI không soạn được ý nào dùng được. Không ghi gì cả.' },
      { status: 502 },
    )
  }

  const { error } = await supabase.from('canvas_blocks').upsert(
    dongGhi.map((x) => ({
      tenant_id: auth.tenantId,
      block_key: x.k,
      items: x.items,
      nguon: 'ai',
      ai_model: r.model || DEFAULT_MODEL,
      ai_luc: luc,
      nguoi_sua: null,
    })),
    { onConflict: 'tenant_id,block_key' },
  )
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: doDay } = await supabase.rpc('do_day_canvas', { p_tenant: auth.tenantId })
  const d = Array.isArray(doDay) ? doDay[0] : doDay

  return NextResponse.json({
    data: {
      da_ghi: dongGhi.map((x) => x.k),
      bo_qua: [...nguoiDaViet],
      mo_hinh: r.model || DEFAULT_MODEL,
      do_day: d ?? null,
      ghi_chu:
        'Đây là BẢN NHÁP do máy soạn, đã gắn nhãn nguồn. Đọc lại và sửa từng khối — ' +
        'nhà đầu tư sẽ hỏi vì sao bạn chọn phân khúc này chứ không hỏi máy.',
    },
  })
}
