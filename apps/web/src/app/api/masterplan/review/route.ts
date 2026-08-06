import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase/server'
import { requireUserAndTenant } from '@/lib/api/tenant'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * POST /api/masterplan/review — đối chiếu KẾ HOẠCH NĂM ↔ THỰC TẾ.
 * RPC plan_vs_actual so masterplan với P&L thực (luỹ kế trong năm), nhân sự đã
 * tuyển (org_positions filled) và vốn đã gọi (fundraise_rounds) → khoảng lệch
 * kèm mức độ. Đây là báo cáo chủ tịch/CEO đọc mỗi tháng.
 */

const BodySchema = z.object({ year: z.number().int().min(2020).max(2060).optional() })

export async function POST(req: Request) {
  const supabase = await createServerClient()
  const auth = await requireUserAndTenant(supabase)
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status })

  const body = await req.json().catch(() => ({}))
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { data, error } = await supabase.rpc('plan_vs_actual', {
    p_tenant: auth.tenantId,
    p_year: parsed.data.year ?? null,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const r = data as { ok: boolean; error?: string }
  if (!r?.ok) return NextResponse.json({ error: r?.error ?? 'review failed' }, { status: 422 })
  return NextResponse.json({ data: r })
}
