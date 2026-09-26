import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase/server'
import { requireUserAndTenant } from '@/lib/api/tenant'
import { safeString, safeUuid } from '@/lib/security/schemas'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * SỔ PHÂN PHỐI NGHỊ QUYẾT — chủ tịch và CEO soi được đã giao tới đâu.
 *
 * Không có sổ này thì câu "đã phân kế hoạch xuống phòng ban" cũng chỉ là lời
 * khai. Ở đây trả ra ba con số không thể tự khai: đã giao, đã xác nhận, và
 * **chưa có người đảm nhiệm** — con số thứ ba thường là con số đau nhất, vì nó
 * chỉ ra những ghế trong sơ đồ tổ chức chưa có ai ngồi.
 *
 * ⚠ RANH GIỚI ZENIOS: sổ này giao CHỈ TIÊU và TÀI LIỆU. Hạn mức chi thuộc cột
 * "phân bổ nguồn lực" của ZeniOS — tuyệt đối không giao tiền ở đây.
 */

const XacNhanSchema = z.object({
  id: safeUuid,
  ghi_chu: safeString.max(500).optional(),
})

export async function GET(req: Request) {
  const supabase = await createServerClient()
  const auth = await requireUserAndTenant(supabase)
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status })

  const resolutionId = new URL(req.url).searchParams.get('resolution_id')

  let q = supabase
    .from('resolution_distribution')
    .select('*')
    .eq('tenant_id', auth.tenantId)
  if (resolutionId) q = q.eq('resolution_id', resolutionId)

  const { data, error } = await q.order('delivered_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const ds = (data ?? []) as Array<{ status: string; position_code: string | null }>

  return NextResponse.json({
    data,
    tong_hop: {
      tong: ds.length,
      da_giao: ds.filter((x) => x.status === 'da_giao').length,
      da_xac_nhan: ds.filter((x) => x.status === 'da_xac_nhan').length,
      chua_co_nguoi: ds.filter((x) => x.status === 'chua_co_nguoi').length,
      ghe_chua_co_nguoi: ds.filter((x) => x.status === 'chua_co_nguoi').map((x) => x.position_code),
    },
    ghi_chu:
      ds.length === 0
        ? 'Chưa có nghị quyết nào được phân phối. Nghị quyết phải THÔNG QUA trước mới phân phối được.'
        : null,
  })
}

/** Người nhận xác nhận đã đọc. Chỉ chính người được giao mới xác nhận được. */
export async function POST(req: Request) {
  const parsed = XacNhanSchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const supabase = await createServerClient()
  const auth = await requireUserAndTenant(supabase)
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status })

  const { data: ban } = await supabase
    .from('resolution_distribution')
    .select('id, assignee_id, status')
    .eq('id', parsed.data.id)
    .eq('tenant_id', auth.tenantId)
    .maybeSingle()
  if (!ban) return NextResponse.json({ error: 'Không tìm thấy bản giao' }, { status: 404 })

  const b = ban as { assignee_id: string | null; status: string }
  if (b.status === 'chua_co_nguoi') {
    return NextResponse.json(
      { error: 'Ghế này chưa có người đảm nhiệm — phải gán người trước khi xác nhận' },
      { status: 409 },
    )
  }
  // Xác nhận thay người khác thì chữ "đã xác nhận" mất hết ý nghĩa.
  if (b.assignee_id && b.assignee_id !== auth.user.id) {
    return NextResponse.json(
      { error: 'Chỉ người được giao mới xác nhận được bản giao này' },
      { status: 403 },
    )
  }

  const { data, error } = await supabase
    .from('resolution_distribution')
    .update({
      status: 'da_xac_nhan',
      acknowledged_at: new Date().toISOString(),
      acknowledged_by: auth.user.id,
      ghi_chu: parsed.data.ghi_chu ?? null,
    })
    .eq('id', parsed.data.id)
    .eq('tenant_id', auth.tenantId)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
