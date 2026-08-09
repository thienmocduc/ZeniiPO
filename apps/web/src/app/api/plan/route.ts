import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase/server'
import { requireUserAndTenant } from '@/lib/api/tenant'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * ZIPO-104 · Quản lý bản kế hoạch tài chính (plan_versions).
 * GET  → danh sách version + dòng + assumptions + danh mục COA VAS.
 * POST → tạo version mới (bản nháp). Publish đi qua /api/plan/publish.
 */

type Rows = Array<Record<string, unknown>>
const safe = (r: { data: unknown; error: unknown }): Rows =>
  r.error || !Array.isArray(r.data) ? [] : (r.data as Rows)

export async function GET(req: Request) {
  const supabase = await createServerClient()
  const auth = await requireUserAndTenant(supabase)
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status })

  const { searchParams } = new URL(req.url)
  const versionId = searchParams.get('version_id')

  const [versionsR, coaR] = await Promise.all([
    supabase
      .from('plan_versions')
      .select('id, version_no, name, horizon_months, start_period, status, published_at, created_at')
      .order('version_no', { ascending: false }),
    supabase.from('plan_coa_lines').select('*').order('display_order'),
  ])
  const versions = safe(versionsR)
  const target = versionId ?? (versions[0]?.id as string | undefined)

  let lines: Rows = []
  let assumptions: Rows = []
  let targetCount = 0
  if (target) {
    const [l, a, t] = await Promise.all([
      supabase.from('plan_lines').select('*').eq('plan_version_id', target).order('coa_line'),
      supabase.from('plan_assumptions').select('*').eq('plan_version_id', target).order('key'),
      supabase.from('plan_targets').select('id', { count: 'exact', head: true }).eq('plan_version_id', target),
    ])
    lines = safe(l)
    assumptions = safe(a)
    targetCount = t.count ?? 0
  }

  return NextResponse.json({
    data: {
      versions,
      coa_lines: safe(coaR),
      current: target ?? null,
      lines,
      assumptions,
      targets_count: targetCount,
    },
  })
}

const PostSchema = z.object({
  name: z.string().trim().max(200).optional(),
  horizon_months: z.number().int().min(12).max(60).default(36),
  start_period: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'start_period dạng YYYY-MM'),
  business_model_id: z.string().uuid().optional(),
  /** Sao chép dòng + assumptions từ version cũ (tạo bản kế tiếp) */
  clone_from: z.string().uuid().optional(),
})

export async function POST(req: Request) {
  const supabase = await createServerClient()
  const auth = await requireUserAndTenant(supabase)
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status })

  const body = await req.json().catch(() => ({}))
  const parsed = PostSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { data: last } = await supabase
    .from('plan_versions')
    .select('version_no')
    .order('version_no', { ascending: false })
    .limit(1)
  const nextNo = Number(last?.[0]?.version_no ?? 0) + 1

  const { data: created, error } = await supabase
    .from('plan_versions')
    .insert({
      tenant_id: auth.tenantId,
      version_no: nextNo,
      name: parsed.data.name ?? `Kế hoạch v${nextNo}`,
      horizon_months: parsed.data.horizon_months,
      start_period: `${parsed.data.start_period}-01`,
      business_model_id: parsed.data.business_model_id ?? null,
      status: 'draft',
    })
    .select('id, version_no, name, status')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Bản kế tiếp: chép nguyên dòng + assumptions để sửa, KHÔNG đụng bản cũ.
  let cloned = 0
  if (parsed.data.clone_from) {
    const [srcLines, srcAssum] = await Promise.all([
      supabase.from('plan_lines').select('*').eq('plan_version_id', parsed.data.clone_from),
      supabase.from('plan_assumptions').select('*').eq('plan_version_id', parsed.data.clone_from),
    ])
    const lines = (srcLines.data ?? []).map((l) => ({
      tenant_id: auth.tenantId, plan_version_id: created.id, company_id: l.company_id,
      coa_line: l.coa_line, label_vi: l.label_vi, driver_type: l.driver_type, driver_config: l.driver_config,
    }))
    const assum = (srcAssum.data ?? []).map((a) => ({
      tenant_id: auth.tenantId, plan_version_id: created.id, key: a.key, label_vi: a.label_vi,
      unit: a.unit, value_base: a.value_base, value_bull: a.value_bull, value_bear: a.value_bear,
    }))
    if (lines.length) await supabase.from('plan_lines').insert(lines)
    if (assum.length) await supabase.from('plan_assumptions').insert(assum)
    cloned = lines.length + assum.length
  }

  return NextResponse.json({ data: { ...created, cloned_rows: cloned } }, { status: 201 })
}
