import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase/server'
import { requireUserAndTenant } from '@/lib/api/tenant'
import { buildPlanInput } from '@/lib/plan/build-input'
import { runPlanEngine, toPlanTargets } from '@/lib/plan/engine'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 120

/**
 * ZIPO-104 · POST /api/plan/publish — chốt bản kế hoạch.
 *
 * Trong MỘT giao dịch (RPC publish_plan_version):
 *   1. sinh plan_targets từ output engine (BIGINT VND, kỳ tháng, mã COA)
 *   2. khoá version sang 'published' → trigger DB chặn mọi UPDATE về sau
 * Lỗi bất kỳ bước nào → rollback toàn bộ, không để trạng thái nửa vời.
 *
 * Sau publish: sửa kế hoạch = tạo version mới (bản cũ giữ vĩnh viễn để nhà
 * đầu tư soi "hứa vs làm").
 */

const BodySchema = z.object({
  version_id: z.string().uuid(),
  /** Kịch bản dùng làm chỉ tiêu chính thức gửi ZeniOS. */
  scenario: z.enum(['base', 'bull', 'bear']).default('base'),
})

export async function POST(req: Request) {
  const supabase = await createServerClient()
  const auth = await requireUserAndTenant(supabase)
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status })

  const body = await req.json().catch(() => ({}))
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const built = await buildPlanInput(supabase, parsed.data.version_id)
  if (!built.ok) return NextResponse.json({ error: built.error }, { status: 422 })

  let targets
  try {
    const result = runPlanEngine(built.input, parsed.data.scenario)
    targets = toPlanTargets(built.input, result)
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Engine lỗi' }, { status: 422 })
  }
  if (targets.length === 0) {
    return NextResponse.json({ error: 'Engine không sinh chỉ tiêu nào — kiểm tra lại các dòng kế hoạch.' }, { status: 422 })
  }

  const { data, error } = await supabase.rpc('publish_plan_version', {
    p_tenant: auth.tenantId,
    p_version_id: parsed.data.version_id,
    p_targets: targets,
    p_user: auth.user.id,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const r = data as { ok: boolean; error?: string; version_no?: number; targets_written?: number }
  if (!r?.ok) return NextResponse.json({ error: r?.error ?? 'Publish thất bại' }, { status: 409 })

  return NextResponse.json({
    data: {
      version_no: r.version_no,
      scenario: parsed.data.scenario,
      targets_written: r.targets_written,
      immutable: true,
      note: 'Bản này đã khoá. Muốn sửa → tạo version mới; bản cũ giữ vĩnh viễn.',
      contract: `/api/internal/plan-targets?tenant=<slug>&version=${r.version_no}`,
    },
  })
}
