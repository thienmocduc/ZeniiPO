import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase/server'
import { requireUserAndTenant } from '@/lib/api/tenant'
import { buildPlanInput } from '@/lib/plan/build-input'
import { runAllScenarios, runSensitivity, toPlanTargets } from '@/lib/plan/engine'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

/**
 * POST /api/plan/run — chạy engine cho một plan version (KHÔNG ghi gì).
 * Xem trước P&L/CF, 3 kịch bản, bảng sensitivity trước khi publish.
 * Publish (ghi plan_targets bất biến) là endpoint riêng /api/plan/publish.
 */

const BodySchema = z.object({
  version_id: z.string().uuid(),
  scenario: z.enum(['base', 'bull', 'bear']).default('base'),
  with_sensitivity: z.boolean().default(false),
  sensitivity_year: z.number().int().min(1).max(5).default(3),
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

  try {
    const all = runAllScenarios(built.input)
    const chosen = all[parsed.data.scenario]
    const sensitivity = parsed.data.with_sensitivity
      ? runSensitivity(built.input, parsed.data.sensitivity_year)
      : null
    return NextResponse.json({
      data: {
        scenario: parsed.data.scenario,
        currency: 'VND',
        // Ràng buộc #5: số kèm nhãn nguồn
        source: `engine:plan-run · version ${parsed.data.version_id.slice(0, 8)}`,
        months: chosen.months,
        yearly: chosen.yearly,
        summary: chosen.summary,
        scenarios: { base: all.base.summary, bull: all.bull.summary, bear: all.bear.summary },
        sensitivity,
        targets_preview: toPlanTargets(built.input, chosen).length,
      },
    })
  } catch (err) {
    // Fail-closed: lỗi assumption → 422 kèm thông điệp gốc để người dùng sửa.
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Engine lỗi' }, { status: 422 })
  }
}
