import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase/server'
import { requireUserAndTenant } from '@/lib/api/tenant'
import { safeString, safeUuid } from '@/lib/security/schemas'
import { LOAI_NGHI_QUYET, PHIEU } from '@/lib/zeni/vai'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * NGHỊ QUYẾT HỘI ĐỒNG — sự kiện CÓ HIỆU LỰC PHÁP LÝ, không phải tệp đính kèm.
 *
 * Ba việc chỉ CSDL được làm, cửa vào này không tự quyết:
 *   1. `chot`      → `chot_nghi_quyet()` kiểm túc số từ điểm danh thật, đếm phiếu
 *                    từ bảng phiếu, gắn băm nội dung vào `phe_duyet`. Thiếu túc
 *                    số thì NÉM LỖI.
 *   2. `phan_phoi` → `phan_phoi_nghi_quyet()` giao xuống từng GHẾ theo cây
 *                    `position_templates`, chỉ khi nghị quyết đã thông qua.
 *   3. Số phiếu     → cột `votes_for/against/abstain` là số DẪN RA từ `board_votes`,
 *                    không nhận giá trị gõ tay. Cửa vào này không cho sửa chúng.
 *
 * ⚠ `plan_version_id` là mắt nối bịt LỖ HỔNG THẨM QUYỀN: trước đây
 * `plan_versions` chỉ có `published_by` nên ZeniOS không có cách biết bản kế
 * hoạch nó phân bổ đã được hội đồng duyệt hay chỉ do một người bấm "công bố".
 */

const TaoSchema = z.object({
  resolution_no: safeString.min(1).max(60),
  title: safeString.min(2).max(300),
  body: safeString.min(1).max(20000),
  meeting_date: z.string().date(),
  resolution_type: z.enum(LOAI_NGHI_QUYET),
  meeting_id: safeUuid.optional(),
  /** Bản kế hoạch mà nghị quyết này cho phép thực thi. */
  plan_version_id: safeUuid.optional(),
  minutes_id: safeUuid.optional(),
})

const HanhDongSchema = z.object({
  id: safeUuid,
  hanh_dong: z.enum(['chot', 'phan_phoi', 'gan_ke_hoach', 'bo_phieu']),
  plan_version_id: safeUuid.optional(),
  phieu: z
    .array(z.object({
      member_id: safeUuid,
      vote: z.enum(PHIEU),
      ly_do_khong_bieu_quyet: safeString.max(500).optional(),
    }))
    .optional(),
})

export async function GET(req: Request) {
  const supabase = await createServerClient()
  const auth = await requireUserAndTenant(supabase)
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status })

  // Giữ lại hai bộ lọc mà khung CRUD chung trước đây cung cấp
  // (`searchableColumns: ['status','resolution_type']`) — thay cửa vào mà bỏ mất
  // tính năng thì là làm hỏng, không phải làm mới.
  const sp = new URL(req.url).searchParams
  const id = sp.get('id')
  const trangThai = sp.get('status')
  const loai = sp.get('resolution_type')

  let q = supabase.from('board_resolutions').select('*').eq('tenant_id', auth.tenantId)
  if (trangThai) q = q.eq('status', trangThai)
  if (loai) q = q.eq('resolution_type', loai)

  const { data, error } = id ? await q.eq('id', id) : await q.order('meeting_date', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  let phieu: unknown[] = []
  let phanPhoi: unknown[] = []
  if (id) {
    const [{ data: v }, { data: d }] = await Promise.all([
      supabase.from('board_votes').select('*').eq('resolution_id', id),
      supabase.from('resolution_distribution').select('*').eq('resolution_id', id),
    ])
    phieu = v ?? []
    phanPhoi = d ?? []
  }
  return NextResponse.json({ data, phieu, phan_phoi: phanPhoi })
}

export async function POST(req: Request) {
  const parsed = TaoSchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const supabase = await createServerClient()
  const auth = await requireUserAndTenant(supabase)
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status })

  const { data, error } = await supabase
    .from('board_resolutions')
    .insert({ ...parsed.data, tenant_id: auth.tenantId, status: 'draft' })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}

export async function PATCH(req: Request) {
  const parsed = HanhDongSchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const supabase = await createServerClient()
  const auth = await requireUserAndTenant(supabase)
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status })

  const { id, hanh_dong } = parsed.data

  const { data: nq } = await supabase
    .from('board_resolutions')
    .select('id, status')
    .eq('id', id)
    .eq('tenant_id', auth.tenantId)
    .maybeSingle()
  if (!nq) return NextResponse.json({ error: 'Không tìm thấy nghị quyết' }, { status: 404 })

  if (hanh_dong === 'bo_phieu') {
    if (!parsed.data.phieu?.length) {
      return NextResponse.json({ error: 'Chưa có phiếu nào' }, { status: 400 })
    }
    for (const p of parsed.data.phieu) {
      if (p.vote === 'khong_bieu_quyet' && !p.ly_do_khong_bieu_quyet) {
        return NextResponse.json(
          { error: 'Không biểu quyết phải ghi lý do — thường là xung đột lợi ích' },
          { status: 400 },
        )
      }
      const { error } = await supabase
        .from('board_votes')
        .upsert({ resolution_id: id, ...p }, { onConflict: 'resolution_id,member_id' })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ data: { id, so_phieu_ghi: parsed.data.phieu.length } })
  }

  if (hanh_dong === 'gan_ke_hoach') {
    if (!parsed.data.plan_version_id) {
      return NextResponse.json({ error: 'Thiếu plan_version_id' }, { status: 400 })
    }
    if (nq.status === 'executed') {
      return NextResponse.json(
        { error: 'Nghị quyết đã thực thi — đổi bản kế hoạch gắn kèm là sửa lịch sử' },
        { status: 409 },
      )
    }
    const { error } = await supabase
      .from('board_resolutions')
      .update({ plan_version_id: parsed.data.plan_version_id, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('tenant_id', auth.tenantId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data: { id, plan_version_id: parsed.data.plan_version_id } })
  }

  // `chot` và `phan_phoi` đều ném lỗi khi điều kiện chưa đủ. Trả 409 thay vì 500:
  // đây là quy tắc nghiệp vụ đang hoạt động đúng, không phải sự cố hệ thống.
  const ham = hanh_dong === 'chot' ? 'chot_nghi_quyet' : 'phan_phoi_nghi_quyet'
  const { data, error } = await supabase.rpc(ham, { p_resolution_id: id })
  if (error) {
    const laQuyTac =
      error.message.includes('túc số') ||
      error.message.includes('trạng thái') ||
      error.message.includes('phiếu biểu quyết') ||
      error.message.includes('kỳ họp')
    return NextResponse.json({ error: error.message }, { status: laQuyTac ? 409 : 500 })
  }
  return NextResponse.json({ data })
}
