import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase/server'
import { safeString, safeUuid } from '@/lib/security/schemas'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * PATCH /api/readiness/criteria/[id] — cập nhật một tiêu chí sẵn sàng IPO.
 *
 * ── HAI LỖI ĐÃ VÁ Ở ĐÂY ──
 *
 * 1. GHI VÀO CỘT KHÔNG TỒN TẠI. Bản cũ nhận `evidence_url` và `evidence_note`
 *    rồi đưa thẳng vào UPDATE. Bảng `ipo_readiness_criteria` không có hai cột
 *    đó (đã soi lược đồ thật) — nó có `evidence_file_id` trỏ sang
 *    `data_room_docs` và `notes`. Nên mọi lần người dùng đính kèm bằng chứng
 *    đều trả lỗi 500. Chức năng nộp bằng chứng chưa bao giờ chạy được.
 *
 * 2. TỰ PHONG "ĐÃ XÁC MINH". Bản cũ nhận `status` là chuỗi bất kỳ, nên đặt
 *    'verified' cho tiêu chí "Kiểm toán Big 4 hai năm liên tiếp" mà không kèm
 *    một tờ giấy nào — và điểm sẵn sàng vẫn lên. Nay:
 *      · trạng thái phải nằm trong tập hợp lệ;
 *      · 'verified' đòi `evidence_file_id` — từ chối sớm kèm lời giải thích
 *        tiếng Việt, thay vì để CSDL ném lỗi ràng buộc khó hiểu;
 *      · `verified_by` và `verified_at` do MÁY CHỦ điền từ phiên đăng nhập.
 *        Không nhận từ trình duyệt: nhận thì ai cũng khai được là người khác
 *        đã xác minh giúp mình.
 *
 * Bằng chứng phải là hồ sơ nằm trong phòng dữ liệu của CÙNG doanh nghiệp —
 * kiểm tra trước khi ghi, không để RLS làm cửa cuối.
 */

const TRANG_THAI = ['not_started', 'in_progress', 'ready', 'verified', 'blocked'] as const

const UpdateSchema = z.object({
  status: z.enum(TRANG_THAI).optional(),
  /** Hồ sơ trong data_room_docs chứng minh tiêu chí. null = gỡ bằng chứng. */
  evidence_file_id: safeUuid.nullable().optional(),
  notes: safeString.optional(),
  score_pct: z.number().int().min(0).max(100).optional(),
})

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!safeUuid.safeParse(id).success) {
    return NextResponse.json({ error: 'Mã tiêu chí không hợp lệ' }, { status: 400 })
  }

  const body = await req.json().catch(() => ({}))
  const parsed = UpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 })

  // Đọc tiêu chí hiện tại — RLS đã giới hạn trong doanh nghiệp của người dùng.
  const { data: hienTai, error: loiDoc } = await supabase
    .from('ipo_readiness_criteria')
    .select('id, tenant_id, status, evidence_file_id, name_vi')
    .eq('id', id)
    .maybeSingle()
  if (loiDoc) return NextResponse.json({ error: loiDoc.message }, { status: 500 })
  if (!hienTai) return NextResponse.json({ error: 'Không tìm thấy tiêu chí' }, { status: 404 })

  const capNhat: Record<string, unknown> = {}
  if (parsed.data.notes !== undefined) capNhat.notes = parsed.data.notes
  if (parsed.data.score_pct !== undefined) capNhat.score_pct = parsed.data.score_pct

  // Bằng chứng phải là hồ sơ CÓ THẬT trong phòng dữ liệu cùng doanh nghiệp.
  if (parsed.data.evidence_file_id !== undefined) {
    if (parsed.data.evidence_file_id === null) {
      capNhat.evidence_file_id = null
    } else {
      const { data: hoSo } = await supabase
        .from('data_room_docs')
        .select('id')
        .eq('id', parsed.data.evidence_file_id)
        .eq('tenant_id', hienTai.tenant_id)
        .maybeSingle()
      if (!hoSo) {
        return NextResponse.json(
          { error: 'Hồ sơ bằng chứng không có trong phòng dữ liệu của doanh nghiệp này.' },
          { status: 422 },
        )
      }
      capNhat.evidence_file_id = parsed.data.evidence_file_id
    }
  }

  if (parsed.data.status !== undefined) {
    capNhat.status = parsed.data.status
    if (parsed.data.status === 'verified') {
      // Hồ sơ sau khi áp thay đổi lần này — không phải hồ sơ trước đó.
      const hoSoSauKhiSua =
        'evidence_file_id' in capNhat ? capNhat.evidence_file_id : hienTai.evidence_file_id
      if (!hoSoSauKhiSua) {
        return NextResponse.json(
          {
            error:
              `Không thể đánh dấu "đã xác minh" cho tiêu chí "${hienTai.name_vi}" khi chưa đính kèm hồ sơ. ` +
              'Bên thẩm định sẽ đòi hồ sơ cho từng tiêu chí — tiêu chí không có hồ sơ bị tính bằng 0.',
          },
          { status: 422 },
        )
      }
      // Máy chủ tự điền người xác minh và thời điểm. Không lấy từ thân yêu cầu.
      capNhat.verified_by = user.id
      capNhat.verified_at = new Date().toISOString()
    } else {
      // Rời khỏi trạng thái đã xác minh thì xoá dấu xác minh cũ, để không còn
      // một chữ ký treo lại trên tiêu chí đã bị hạ cấp.
      capNhat.verified_by = null
      capNhat.verified_at = null
    }
  }

  if (Object.keys(capNhat).length === 0) {
    return NextResponse.json({ error: 'Không có trường nào để cập nhật' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('ipo_readiness_criteria')
    .update(capNhat)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
