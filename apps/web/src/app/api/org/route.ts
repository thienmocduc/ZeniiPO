import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase/server'
import { requireUserAndTenant } from '@/lib/api/tenant'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Sơ đồ tổ chức + khung năng lực từng vị trí.
 *
 * GET  → units (12 phòng ban chuẩn) + templates (thư viện ghế chuẩn kèm NĂNG LỰC
 *        + quyền quyết định + KPI sở hữu) + positions của tenant + gợi ý ghế
 *        CÒN THIẾU theo bước hành trình hiện tại.
 * POST → tạo ghế (tự copy năng lực/quyền/KPI từ template nếu có template_code).
 */

type Rows = Array<Record<string, unknown>>
const safe = (r: { data: unknown; error: unknown }): Rows =>
  r.error || !Array.isArray(r.data) ? [] : (r.data as Rows)

export async function GET() {
  const supabase = await createServerClient()
  const auth = await requireUserAndTenant(supabase)
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status })

  const [unitsR, tplR, posR, journeyR] = await Promise.all([
    supabase.from('org_units').select('*').order('display_order'),
    supabase.from('position_templates').select('*').order('display_order'),
    supabase.from('org_positions').select('*').order('level').order('title_vi'),
    supabase.from('ipo_journeys').select('current_phase').eq('status', 'active').limit(1),
  ])

  const units = safe(unitsR)
  const templates = safe(tplR)
  const positions = safe(posR)
  const phase = Number(safe(journeyR)[0]?.current_phase ?? 1)

  // Ghế CẦN CÓ ở bước hiện tại mà tenant chưa lập → gợi ý tuyển/bổ nhiệm.
  const haveTpl = new Set(positions.map((p) => String(p.template_code ?? '')))
  const missing = templates
    .filter((t) => Number(t.min_phase ?? 1) <= phase && !haveTpl.has(String(t.template_code)))
    .map((t) => ({
      template_code: t.template_code,
      title_vi: t.title_vi,
      unit_code: t.unit_code,
      level: t.level,
      mission_vi: t.mission_vi,
      min_phase: t.min_phase,
    }))

  const filled = positions.filter((p) => p.status === 'filled').length
  return NextResponse.json({
    data: {
      units,
      templates,
      positions,
      current_phase: phase,
      missing_positions: missing,
      summary: {
        total: positions.length,
        filled,
        open: positions.filter((p) => p.status === 'open').length,
        coverage_pct: positions.length ? Math.round((filled / positions.length) * 100) : 0,
      },
    },
  })
}

const PostSchema = z.object({
  template_code: z.string().trim().max(64).optional(),
  unit_code: z.string().trim().min(1).max(32),
  title_vi: z.string().trim().min(1).max(200),
  level: z.enum(['c_level', 'director', 'manager', 'lead', 'ic']),
  holder_name: z.string().trim().max(200).optional(),
  status: z.enum(['filled', 'open', 'planned', 'frozen']).default('open'),
  target_hire_date: z.string().trim().max(20).optional(),
})

export async function POST(req: Request) {
  const supabase = await createServerClient()
  const auth = await requireUserAndTenant(supabase)
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status })

  const body = await req.json().catch(() => ({}))
  const parsed = PostSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  // Kế thừa khung năng lực chuẩn từ template (nếu chọn) — đây là phần "full
  // năng lực từng vị trí": ghế mới sinh ra đã có sẵn yêu cầu năng lực.
  let inherited: Record<string, unknown> = {}
  if (parsed.data.template_code) {
    const { data: tpl } = await supabase
      .from('position_templates')
      .select('capabilities, decision_rights, owns_metrics')
      .eq('template_code', parsed.data.template_code)
      .maybeSingle()
    if (tpl) {
      inherited = {
        capabilities: tpl.capabilities,
        decision_rights: tpl.decision_rights,
        owns_metrics: tpl.owns_metrics,
      }
    }
  }

  const { data, error } = await supabase
    .from('org_positions')
    .insert({ tenant_id: auth.tenantId, ...parsed.data, ...inherited })
    .select('id, title_vi, unit_code, status')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}
