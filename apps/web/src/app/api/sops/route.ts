import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase/server'
import { requireUserAndTenant } from '@/lib/api/tenant'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * sop_processes — quy trình vận hành CÓ BƯỚC, chủ sở hữu và SLA.
 * SOP là thứ biến "công ty phụ thuộc người" thành "công ty vận hành được" —
 * điều kiện để scale và để agent tự động hoá theo đúng chuẩn.
 */

export async function GET(req: Request) {
  const supabase = await createServerClient()
  const auth = await requireUserAndTenant(supabase)
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status })

  const { searchParams } = new URL(req.url)
  const unit = searchParams.get('unit_code')

  let q = supabase.from('sop_processes').select('*').order('unit_code').order('title_vi')
  if (unit) q = q.eq('unit_code', unit)
  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const list = data ?? []
  const byUnit: Record<string, number> = {}
  for (const s of list) byUnit[String(s.unit_code ?? 'other')] = (byUnit[String(s.unit_code ?? 'other')] ?? 0) + 1

  return NextResponse.json({
    data: {
      sops: list,
      summary: {
        total: list.length,
        active: list.filter((s) => s.status === 'active').length,
        draft: list.filter((s) => s.status === 'draft').length,
        units_covered: Object.keys(byUnit).length,
        by_unit: byUnit,
      },
    },
  })
}

const StepSchema = z.object({
  no: z.number().int().min(1).max(100),
  action: z.string().trim().min(1).max(500),
  owner: z.string().trim().max(120).optional(),
  sla_hours: z.number().int().min(0).max(10_000).optional(),
})

const PostSchema = z.object({
  title_vi: z.string().trim().min(1).max(200),
  unit_code: z.string().trim().max(32).optional(),
  code: z.string().trim().max(32).optional(),
  purpose_vi: z.string().trim().max(1000).optional(),
  steps: z.array(StepSchema).max(50).default([]),
  frequency: z.enum(['daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'on_demand']).optional(),
  sla_hours: z.number().int().min(0).max(10_000).optional(),
  status: z.enum(['draft', 'active', 'deprecated']).default('draft'),
})

export async function POST(req: Request) {
  const supabase = await createServerClient()
  const auth = await requireUserAndTenant(supabase)
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status })

  const body = await req.json().catch(() => ({}))
  const parsed = PostSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { data, error } = await supabase
    .from('sop_processes')
    .insert({ tenant_id: auth.tenantId, ...parsed.data })
    .select('id, title_vi, unit_code, status')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}
