import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase/server'
import { getCurrentTenantId } from '@/lib/api/tenant'
import { notifyCascadeTriggered } from '@/lib/notify/slack'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const VENUES = ['SGX', 'NASDAQ', 'NYSE', 'HKEX', 'HOSE'] as const

const CascadeSchema = z.object({
  valuation: z.number().positive().finite(),
  venue: z.enum(VENUES),
  year: z.number().int().min(2026).max(2040),
  industry: z.string().trim().min(1).max(100),
  north_star: z.string().trim().max(200).optional(),
  strategy: z.string().trim().min(1).max(5000),
})

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const parsed = CascadeSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tenantId = await getCurrentTenantId(supabase, user.id)
  if (!tenantId) {
    return NextResponse.json({ error: 'No tenant for user' }, { status: 403 })
  }

  // RPC signature: cascade_chairman_event(p_tenant_id, p_valuation, p_venue,
  //   p_year, p_industry, p_strategy). p_venue must match
  //   ipo_journeys.exit_venue check (sgx | nasdaq | nyse | hkex | hose) — lowercase.
  //
  // Sao Bắc Đẩu KHÔNG nằm trong chữ ký này. Thêm tham số thứ 7 có giá trị mặc
  // định sẽ tạo hàm nạp chồng và làm mọi lời gọi 6 tham số trở thành nhập nhằng,
  // nên nó được ghi ở bước riêng ngay dưới. Trước đây `north_star` được nhận ở
  // schema rồi bỏ đi lặng lẽ — chủ tịch nhập xong không thấy đâu cả.
  const { data, error } = await supabase.rpc('cascade_chairman_event', {
    p_tenant_id: tenantId,
    p_valuation: parsed.data.valuation,
    p_venue: parsed.data.venue.toLowerCase(),
    p_year: parsed.data.year,
    p_industry: parsed.data.industry,
    p_strategy: parsed.data.strategy,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // RPC may return a single row or an array — normalize either shape.
  const row = Array.isArray(data) ? data[0] : data

  // Ghi Sao Bắc Đẩu vào hành trình vừa sinh. Không chặn phản hồi nếu lỗi: mục
  // tiêu và cây phân rã đã được ghi xong rồi, hỏng ở đây không được xoá cả việc
  // đã làm — nhưng phải BÁO ra, không nuốt im như bản cũ.
  let canhBao: string | null = null
  if (row?.journey_id && parsed.data.north_star) {
    const { error: nsErr } = await supabase
      .from('ipo_journeys')
      .update({ north_star_metric: parsed.data.north_star })
      .eq('id', row.journey_id)
    if (nsErr) canhBao = `Chưa lưu được Sao Bắc Đẩu: ${nsErr.message}`
  }

  // Slack notification (no-op if SLACK_WEBHOOK_URL missing).
  const { data: tenant } = await supabase
    .from('tenants')
    .select('name')
    .eq('id', tenantId)
    .maybeSingle()
  await notifyCascadeTriggered({
    tenant_name: tenant?.name ?? 'Unknown tenant',
    actor_email: user.email ?? user.id,
    valuation_usd: parsed.data.valuation,
    venue: parsed.data.venue,
    target_year: parsed.data.year,
    industry: parsed.data.industry,
    journey_id: row?.journey_id ?? null,
  })

  // Số đếm lấy từ hàm CSDL, không viết cứng. Bản cũ luôn trả `objectives_count: 4`
  // kể cả khi thực tế sinh ra 14 mục tiêu — hoặc khi sinh ra 0 vì lỗi.
  return NextResponse.json({
    data: {
      event_id: row?.event_id ?? null,
      journey_id: row?.journey_id ?? null,
      objective_goc: row?.objective_goc ?? null,
      muc_tieu_chu_tich: row?.muc_tieu_chu_tich ?? 0,
      muc_tieu_phan_ra: row?.muc_tieu_phan_ra ?? 0,
      key_result: row?.key_result ?? 0,
      chi_tieu_co_chuan: row?.chi_tieu_co_chuan ?? 0,
      chi_tieu_cho_nguoi_dat: row?.chi_tieu_cho_nguoi_dat ?? 0,
      north_star: parsed.data.north_star ?? null,
      canh_bao: canhBao,
    },
  })
}
