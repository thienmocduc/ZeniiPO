import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase/server'
import { requireUserAndTenant } from '@/lib/api/tenant'
import { safeString, safeUuid } from '@/lib/security/schemas'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * SỬA / XOÁ MỘT NGHỊ QUYẾT — chỉ khi còn là BẢN NHÁP.
 *
 * ⚠ CỬA NÀY TỪNG LÀ ĐƯỜNG VÒNG QUA TOÀN BỘ CỔNG TÚC SỐ. Bản trước dùng khung
 * CRUD chung với lược đồ cho phép sửa trực tiếp:
 *     status: 'approved'          ⇒ thông qua nghị quyết mà KHÔNG cần họp
 *     votes_for / votes_against   ⇒ gõ tay số phiếu, không cần ai bỏ phiếu
 * Nghĩa là `chot_nghi_quyet()` kiểm túc số rất nghiêm ở một cửa, còn cửa này mở
 * toang. Một hàng rào có cửa sau thì không phải hàng rào.
 *
 * Nay:
 *   · `status` và `votes_*` KHÔNG nằm trong lược đồ. Muốn thông qua thì gọi
 *     `PATCH /api/board/resolutions` với `hanh_dong: 'chot'` — ở đó túc số được
 *     tính từ điểm danh thật và số phiếu dẫn ra từ `board_votes`.
 *   · Chỉ sửa được khi còn `draft`. Nghị quyết đã biểu quyết mà sửa nội dung thì
 *     băm nội dung trong `phe_duyet` không còn khớp — tức là phá luôn bằng chứng.
 *   · XOÁ cũng chỉ khi còn `draft`. Xoá nghị quyết đã thông qua là xoá lịch sử
 *     quản trị, và đó đúng là thứ bên thẩm định đối chiếu số hiệu để tìm lỗ.
 */

const SuaSchema = z.object({
  title: safeString.min(2).max(300).optional(),
  body: safeString.min(1).max(20000).optional(),
  resolution_no: safeString.min(1).max(60).optional(),
  meeting_date: z.string().date().optional(),
  meeting_id: safeUuid.optional().nullable(),
  minutes_id: safeUuid.optional().nullable(),
})

/** Trạng thái duy nhất còn cho sửa/xoá. */
const CHO_SUA = 'draft'

async function layNghiQuyet(id: string) {
  if (!z.string().uuid().safeParse(id).success) {
    return { loi: NextResponse.json({ error: 'Mã nghị quyết không hợp lệ' }, { status: 400 }) }
  }
  const supabase = await createServerClient()
  const auth = await requireUserAndTenant(supabase)
  if (!auth.ok) {
    return { loi: NextResponse.json({ error: auth.message }, { status: auth.status }) }
  }
  const { data } = await supabase
    .from('board_resolutions')
    .select('id, status')
    .eq('id', id)
    .eq('tenant_id', auth.tenantId)
    .maybeSingle()
  if (!data) {
    return { loi: NextResponse.json({ error: 'Không tìm thấy nghị quyết' }, { status: 404 }) }
  }
  return { supabase, auth, nq: data as { id: string; status: string } }
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const r = await layNghiQuyet(id)
  if (r.loi) return r.loi

  const { data, error } = await r.supabase
    .from('board_resolutions')
    .select('*')
    .eq('id', id)
    .eq('tenant_id', r.auth.tenantId)
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const [{ data: phieu }, { data: giao }] = await Promise.all([
    r.supabase.from('board_votes').select('*').eq('resolution_id', id),
    r.supabase.from('resolution_distribution').select('*').eq('resolution_id', id),
  ])
  return NextResponse.json({ data, phieu: phieu ?? [], phan_phoi: giao ?? [] })
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const r = await layNghiQuyet(id)
  if (r.loi) return r.loi

  if (r.nq.status !== CHO_SUA) {
    return NextResponse.json(
      {
        error:
          `Nghị quyết đang ở trạng thái "${r.nq.status}" — chỉ sửa được khi còn bản nháp. ` +
          'Sửa nội dung sau khi biểu quyết thì băm nội dung đã lưu không còn khớp, tức là phá bằng chứng.',
      },
      { status: 409 },
    )
  }

  const tho = (await req.json().catch(() => ({}))) as Record<string, unknown>

  // Nói RÕ vì sao bốn trường này bị từ chối, thay vì để zod lặng lẽ gỡ chúng rồi
  // trả "không có trường nào để sửa". Thông báo mơ hồ khiến người sau tưởng cửa
  // vào bị hỏng và "sửa" nó bằng cách thêm lại chúng vào lược đồ — tức là mở lại
  // đúng cửa sau vừa bịt.
  const camGhi = ['status', 'votes_for', 'votes_against', 'votes_abstain'].filter((k) => k in tho)
  if (camGhi.length > 0) {
    return NextResponse.json(
      {
        error:
          `Không sửa trực tiếp được: ${camGhi.join(', ')}. ` +
          'Trạng thái và số phiếu là kết quả DẪN RA, không phải giá trị gõ vào — ' +
          'gọi PATCH /api/board/resolutions với hanh_dong "bo_phieu" rồi "chot". ' +
          'Ở đó túc số được tính từ điểm danh thật và nghị quyết thiếu túc số bị từ chối.',
        di_dau: { bo_phieu: 'PATCH /api/board/resolutions', chot: 'PATCH /api/board/resolutions' },
      },
      { status: 422 },
    )
  }

  const parsed = SuaSchema.safeParse(tho)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: 'Không có trường nào để sửa' }, { status: 400 })
  }

  const { data, error } = await r.supabase
    .from('board_resolutions')
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('tenant_id', r.auth.tenantId)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const r = await layNghiQuyet(id)
  if (r.loi) return r.loi

  if (r.nq.status !== CHO_SUA) {
    return NextResponse.json(
      {
        error:
          `Nghị quyết đang ở trạng thái "${r.nq.status}" — không xoá được. ` +
          'Số hiệu nghị quyết là dãy liên tục mà bên thẩm định đối chiếu; một số hiệu biến mất ' +
          'là một câu hỏi phải trả lời. Muốn vô hiệu thì ra nghị quyết mới bãi bỏ nghị quyết cũ.',
      },
      { status: 409 },
    )
  }

  const { error } = await r.supabase
    .from('board_resolutions')
    .delete()
    .eq('id', id)
    .eq('tenant_id', r.auth.tenantId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
