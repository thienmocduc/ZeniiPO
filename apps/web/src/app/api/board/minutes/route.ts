import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createHash } from 'node:crypto'
import { createServerClient } from '@/lib/supabase/server'
import { requireUserAndTenant } from '@/lib/api/tenant'
import { safeString, safeUuid } from '@/lib/security/schemas'
import { NGUON_BIEN_BAN } from '@/lib/zeni/vai'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * BIÊN BẢN HỌP HỘI ĐỒNG.
 *
 * ⚠ AI ĐƯỢC SOẠN NHÁP, KHÔNG ĐƯỢC KÝ. `nguon = 'ai_de_xuat'` buộc phải ghi
 * `ai_model` (ràng buộc `nhap_ai_phai_ghi_mo_hinh` trong CSDL). Một bản nháp AI
 * không nhãn nguồn trộn lẫn với biên bản người soạn là đúng loại rủi ro mà
 * thẩm định viên tìm.
 *
 * ⚠ BẢN KÝ THẮNG BẢN GÕ. `body_md` là nội dung máy đọc được; `doc_id` trỏ tới
 * bản quét có chữ ký trong `data_room_docs`. Khi hai bản lệch nhau thì bản ký
 * là bản có hiệu lực — vì vậy `content_hash` băm đúng phần văn bản, để về sau
 * chứng minh được bản máy đọc chưa bị sửa sau khi ký.
 *
 * Phiên bản chỉ TĂNG, không ghi đè: sửa biên bản đã có = tạo version mới.
 */

const TaoSchema = z.object({
  meeting_id: safeUuid,
  body_md: safeString.min(1).max(200000).optional(),
  doc_id: safeUuid.optional(),
  nguon: z.enum(NGUON_BIEN_BAN).default('nguoi_soan'),
  ai_model: safeString.max(80).optional(),
})

const DuyetSchema = z.object({ id: safeUuid })

export async function GET(req: Request) {
  const supabase = await createServerClient()
  const auth = await requireUserAndTenant(supabase)
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status })

  const meetingId = new URL(req.url).searchParams.get('meeting_id')
  let q = supabase.from('board_minutes').select('*').eq('tenant_id', auth.tenantId)
  if (meetingId) q = q.eq('meeting_id', meetingId)

  const { data, error } = await q.order('version', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(req: Request) {
  const parsed = TaoSchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const supabase = await createServerClient()
  const auth = await requireUserAndTenant(supabase)
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status })

  const p = parsed.data
  if (p.nguon === 'ai_de_xuat' && !p.ai_model) {
    return NextResponse.json(
      { error: 'Bản nháp do AI soạn phải ghi rõ mô hình nào soạn' },
      { status: 400 },
    )
  }
  if (!p.body_md && !p.doc_id) {
    return NextResponse.json(
      { error: 'Biên bản phải có nội dung văn bản hoặc tệp bản ký' },
      { status: 400 },
    )
  }

  const { data: ky } = await supabase
    .from('board_meetings')
    .select('id')
    .eq('id', p.meeting_id)
    .eq('tenant_id', auth.tenantId)
    .maybeSingle()
  if (!ky) return NextResponse.json({ error: 'Không tìm thấy kỳ họp' }, { status: 404 })

  // Phiên bản kế tiếp. Tính từ dữ liệu, không để phía gọi tự chọn số — chọn
  // được số là ghi đè được bản cũ.
  const { data: cu } = await supabase
    .from('board_minutes')
    .select('version')
    .eq('meeting_id', p.meeting_id)
    .order('version', { ascending: false })
    .limit(1)
  const version = (((cu?.[0] as { version?: number } | undefined)?.version ?? 0) as number) + 1

  const { data, error } = await supabase
    .from('board_minutes')
    .insert({
      tenant_id: auth.tenantId,
      meeting_id: p.meeting_id,
      version,
      body_md: p.body_md ?? null,
      doc_id: p.doc_id ?? null,
      nguon: p.nguon,
      ai_model: p.ai_model ?? null,
      content_hash: p.body_md ? createHash('sha256').update(p.body_md, 'utf8').digest('hex') : null,
      drafted_by: auth.user.id,
    })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}

/** Duyệt biên bản. Người soạn không tự duyệt bản của mình. */
export async function PATCH(req: Request) {
  const parsed = DuyetSchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const supabase = await createServerClient()
  const auth = await requireUserAndTenant(supabase)
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status })

  const { data: bb } = await supabase
    .from('board_minutes')
    .select('id, drafted_by, approved_at')
    .eq('id', parsed.data.id)
    .eq('tenant_id', auth.tenantId)
    .maybeSingle()
  if (!bb) return NextResponse.json({ error: 'Không tìm thấy biên bản' }, { status: 404 })

  const b = bb as { drafted_by: string | null; approved_at: string | null }
  if (b.approved_at) {
    return NextResponse.json(
      { error: 'Biên bản đã duyệt — sửa thì tạo phiên bản mới, không duyệt lại' },
      { status: 409 },
    )
  }
  // Cùng nguyên tắc với `phe_duyet.nguoi_soan_khong_tu_duyet` (039): một người
  // vừa soạn vừa duyệt thì bước duyệt không kiểm được gì.
  if (b.drafted_by === auth.user.id) {
    return NextResponse.json(
      { error: 'Người soạn biên bản không tự duyệt được — cần người thứ hai' },
      { status: 403 },
    )
  }

  const { data, error } = await supabase
    .from('board_minutes')
    .update({ approved_at: new Date().toISOString(), approved_by: auth.user.id })
    .eq('id', parsed.data.id)
    .eq('tenant_id', auth.tenantId)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
