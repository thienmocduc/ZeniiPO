import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase/server'
import { requireUserAndTenant } from '@/lib/api/tenant'
import { safeString, safeUuid } from '@/lib/security/schemas'
import {
  HINH_THUC_HOP,
  HINH_THUC_DU_HOP,
  NGUON_TUC_SO,
  TRANG_THAI_HOP,
} from '@/lib/zeni/vai'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * KỲ HỌP HỘI ĐỒNG — trực tiếp, trực tuyến, kết hợp, hoặc lấy ý kiến bằng văn bản.
 *
 * ⚠ TÚC SỐ KHÔNG CÓ CỬA VÀO. Không một tham số nào ở đây cho phép khai "đã đủ
 * túc số". Túc số do `tinh_tuc_so()` tính từ bảng điểm danh thật, và
 * `chot_nghi_quyet()` từ chối khi chưa đủ. Một ô tích "đã đủ túc số" là lời khai
 * và vô giá trị khi thẩm định — nghị quyết thiếu túc số thì VÔ HIỆU.
 *
 * ⚠ `notice_sent_at` (thời điểm gửi triệu tập) không phải trường trang trí:
 * thiếu nó là thiếu bằng chứng đã thông báo đúng thời hạn, và đó là căn cứ để
 * một nghị quyết bị kiện vô hiệu về sau.
 */

const TaoSchema = z.object({
  meeting_no: safeString.min(1).max(60),
  title: safeString.min(2).max(200),
  meeting_type: z.enum(HINH_THUC_HOP),
  scheduled_at: z.string().datetime(),
  committee_id: safeUuid.optional().nullable(),
  location: safeString.max(300).optional(),
  meeting_url: z.string().url().max(500).optional(),
  notice_sent_at: z.string().datetime().optional(),
  convened_by: safeUuid.optional(),
  chaired_by: safeUuid.optional(),
  secretary_id: safeUuid.optional(),
  agenda: z.array(z.object({ muc: safeString.max(300), ghi_chu: safeString.max(500).optional() })).optional(),
  quorum_required_pct: z.number().min(1).max(100).optional(),
  /** Con số túc số ở đâu ra. Điều lệ công ty quyết, nền tảng không đoán. */
  quorum_source: z.enum(NGUON_TUC_SO).optional(),
})

const SuaSchema = z.object({
  id: safeUuid,
  status: z.enum(TRANG_THAI_HOP).optional(),
  actual_start: z.string().datetime().optional(),
  actual_end: z.string().datetime().optional(),
  notice_sent_at: z.string().datetime().optional(),
  quorum_required_pct: z.number().min(1).max(100).optional(),
  quorum_source: z.enum(NGUON_TUC_SO).optional(),
  /** Điểm danh: ghi đè toàn bộ danh sách của kỳ họp này. */
  diem_danh: z
    .array(
      z.object({
        member_id: safeUuid,
        attendance: z.enum(HINH_THUC_DU_HOP),
        proxy_to_member_id: safeUuid.optional().nullable(),
        ghi_chu: safeString.max(300).optional(),
      }),
    )
    .optional(),
})

export async function GET(req: Request) {
  const supabase = await createServerClient()
  const auth = await requireUserAndTenant(supabase)
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status })

  const id = new URL(req.url).searchParams.get('id')

  const q = supabase.from('board_meetings').select('*').eq('tenant_id', auth.tenantId)
  const { data, error } = id
    ? await q.eq('id', id)
    : await q.order('scheduled_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const ds = (data ?? []) as Array<{ id: string }>

  // Túc số tính cho từng kỳ họp — đây là số DẪN RA, không phải số lưu sẵn.
  const tucSo: Record<string, unknown> = {}
  for (const m of ds) {
    const { data: t } = await supabase.rpc('tinh_tuc_so', { p_meeting_id: m.id })
    if (t) tucSo[m.id] = t
  }

  let diemDanh: unknown[] = []
  if (id) {
    const { data: dd } = await supabase
      .from('board_attendance')
      .select('*')
      .eq('meeting_id', id)
    diemDanh = dd ?? []
  }

  return NextResponse.json({ data, tuc_so: tucSo, diem_danh: diemDanh })
}

export async function POST(req: Request) {
  const parsed = TaoSchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const supabase = await createServerClient()
  const auth = await requireUserAndTenant(supabase)
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status })

  const p = parsed.data
  // Hình thức họp phải khớp với thông tin kèm theo, nếu không thì biên bản mô tả
  // một cuộc họp không tồn tại.
  if (p.meeting_type === 'truc_tiep' && !p.location) {
    return NextResponse.json({ error: 'Họp trực tiếp phải có địa điểm' }, { status: 400 })
  }
  if ((p.meeting_type === 'truc_tuyen' || p.meeting_type === 'ket_hop') && !p.meeting_url) {
    return NextResponse.json(
      { error: 'Họp trực tuyến phải có đường dẫn phòng họp' },
      { status: 400 },
    )
  }

  const { data, error } = await supabase
    .from('board_meetings')
    .insert({ ...p, tenant_id: auth.tenantId })
    .select()
    .single()
  if (error) {
    const trung = error.message.includes('uq_meeting_no')
    return NextResponse.json(
      { error: trung ? `Số kỳ họp "${p.meeting_no}" đã tồn tại` : error.message },
      { status: trung ? 409 : 500 },
    )
  }
  return NextResponse.json({ data }, { status: 201 })
}

export async function PATCH(req: Request) {
  const parsed = SuaSchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const supabase = await createServerClient()
  const auth = await requireUserAndTenant(supabase)
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status })

  const { id, diem_danh, ...thayDoi } = parsed.data

  const { data: ky } = await supabase
    .from('board_meetings')
    .select('id')
    .eq('id', id)
    .eq('tenant_id', auth.tenantId)
    .maybeSingle()
  if (!ky) return NextResponse.json({ error: 'Không tìm thấy kỳ họp' }, { status: 404 })

  if (Object.keys(thayDoi).length > 0) {
    const { error } = await supabase
      .from('board_meetings')
      .update({ ...thayDoi, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('tenant_id', auth.tenantId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (diem_danh) {
    // Uỷ quyền phải chỉ rõ người nhận — CSDL cũng canh, nhưng chặn ở đây để trả
    // lỗi đọc được thay vì để lộ thông báo ràng buộc của Postgres.
    for (const d of diem_danh) {
      if (d.attendance === 'uy_quyen' && !d.proxy_to_member_id) {
        return NextResponse.json(
          { error: 'Uỷ quyền phải ghi rõ uỷ cho thành viên nào' },
          { status: 400 },
        )
      }
      if (d.proxy_to_member_id && d.proxy_to_member_id === d.member_id) {
        return NextResponse.json({ error: 'Không thể tự uỷ quyền cho chính mình' }, { status: 400 })
      }
    }
    for (const d of diem_danh) {
      const { error } = await supabase
        .from('board_attendance')
        .upsert({ meeting_id: id, ...d }, { onConflict: 'meeting_id,member_id' })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }

  const { data: tucSo } = await supabase.rpc('tinh_tuc_so', { p_meeting_id: id })
  return NextResponse.json({ data: { id }, tuc_so: tucSo ?? null })
}
