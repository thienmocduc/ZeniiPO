import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase/server'
import { requireUserAndTenant } from '@/lib/api/tenant'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const BLOCK_KEYS = [
  'customer_segments',
  'value_propositions',
  'channels',
  'customer_relationships',
  'revenue_streams',
  'key_resources',
  'key_activities',
  'key_partnerships',
  'cost_structure',
] as const

/** GET /api/canvas — 9 khối BMC của tenant (khối trống trả items []). */
export async function GET() {
  const supabase = await createServerClient()
  const auth = await requireUserAndTenant(supabase)
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status })

  const { data, error } = await supabase
    .from('canvas_blocks')
    .select('block_key, items, updated_at, nguon, ai_model, ai_luc')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const byKey = new Map((data ?? []).map((b) => [b.block_key as string, b]))
  const blocks = BLOCK_KEYS.map((k) => {
    const b = byKey.get(k)
    return {
      block_key: k,
      items: (b?.items as string[] | undefined) ?? [],
      updated_at: b?.updated_at ?? null,
      // Nhãn nguồn: khối trống coi như chưa ai đụng vào.
      nguon: b?.items && (b.items as string[]).length > 0 ? (b.nguon ?? 'nguoi') : null,
      ai_model: b?.ai_model ?? null,
      ai_luc: b?.ai_luc ?? null,
    }
  })

  // Độ đầy tính ở CSDL để giao diện, API và bộ chấm hành trình dùng CHUNG một
  // định nghĩa — ba nơi tự đếm theo ba kiểu là chuyện đã xảy ra ở chỗ khác.
  const { data: doDay } = await supabase.rpc('do_day_canvas', { p_tenant: auth.tenantId })
  const d = (Array.isArray(doDay) ? doDay[0] : doDay) as
    | { so_khoi_co_noi_dung: number; tong_khoi: number; so_khoi_may_soan: number; dat_cong_buoc_1: boolean }
    | null
    | undefined

  return NextResponse.json({
    data: {
      blocks,
      do_day: d ?? null,
      ghi_chu:
        d && !d.dat_cong_buoc_1
          ? `Mới ${d.so_khoi_co_noi_dung}/9 khối có nội dung. Cổng bước 1 của hành trình cần tối thiểu 5 khối.`
          : d && d.so_khoi_may_soan > 0
            ? `${d.so_khoi_may_soan} khối còn là bản nháp máy soạn, bạn chưa xác nhận. Nhà đầu tư sẽ hỏi vì sao bạn chọn như vậy.`
            : 'Mô hình kinh doanh do bạn viết.',
    },
  })
}

const PostSchema = z.object({
  block_key: z.enum(BLOCK_KEYS),
  items: z.array(z.string().trim().min(1).max(300)).max(20),
})

/** POST /api/canvas — upsert một khối BMC. */
export async function POST(req: Request) {
  const supabase = await createServerClient()
  const auth = await requireUserAndTenant(supabase)
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status })

  const body = await req.json().catch(() => ({}))
  const parsed = PostSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { data, error } = await supabase
    .from('canvas_blocks')
    .upsert(
      {
        tenant_id: auth.tenantId,
        block_key: parsed.data.block_key,
        items: parsed.data.items,
        // Người bấm lưu ⇒ khối này là của NGƯỜI, và từ đây AI không đè lên nữa.
        // Kể cả khi họ chỉ sửa một chữ trong bản nháp máy soạn: đọc rồi giữ
        // lại cũng là nhận trách nhiệm về nội dung đó.
        nguon: 'nguoi',
        ai_model: null,
        ai_luc: null,
        nguoi_sua: auth.user.id,
      },
      { onConflict: 'tenant_id,block_key' },
    )
    .select('block_key, items, nguon')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}
