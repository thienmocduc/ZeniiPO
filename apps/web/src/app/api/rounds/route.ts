import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase/server'
import { getCurrentTenantId } from '@/lib/api/tenant'
import { safeString } from '@/lib/security/sanitize'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const STATUSES = ['planning', 'outreach', 'dd', 'term_sheet', 'closing', 'closed'] as const

const CreateSchema = z.object({
  name: safeString.min(1),
  round_type: safeString.min(1),
  target_amount: z.number().positive(),
  pre_money_valuation: z.number().positive().optional(),
  status: z.enum(STATUSES).optional(),
  opened_at: safeString.optional(),
  expected_close_at: safeString.optional(),
})

export async function GET() {
  const supabase = createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('fundraise_rounds')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const supabase = createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tenantId = await getCurrentTenantId(supabase, user.id)
  if (!tenantId) {
    return NextResponse.json({ error: 'No tenant for user' }, { status: 403 })
  }

  const { data, error } = await supabase
    .from('fundraise_rounds')
    .insert({ ...parsed.data, tenant_id: tenantId, status: parsed.data.status ?? 'planning' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}
