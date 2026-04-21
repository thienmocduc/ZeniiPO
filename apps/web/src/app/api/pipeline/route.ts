import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase/server'
import { getCurrentTenantId } from '@/lib/api/tenant'
import { safeString, safeEmail, safeUuid } from '@/lib/security/schemas'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const CreateSchema = z.object({
  round_id: safeUuid.optional().nullable(),
  investor_name: safeString.min(1),
  contact_email: safeEmail.optional(),
  stage: safeString.optional(),
  check_size: z.number().optional(),
  notes: safeString.optional(),
})

export async function GET(req: Request) {
  const supabase = createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const roundId = searchParams.get('round_id')
  const stage = searchParams.get('stage')

  let query = supabase.from('investor_pipeline').select('*')
  if (roundId) {
    const idCheck = safeUuid.safeParse(roundId)
    if (!idCheck.success) {
      return NextResponse.json({ error: 'Invalid round_id' }, { status: 400 })
    }
    query = query.eq('round_id', roundId)
  }
  if (stage) query = query.eq('stage', stage)

  const { data, error } = await query.order('created_at', { ascending: false })
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
    .from('investor_pipeline')
    .insert({ ...parsed.data, tenant_id: tenantId, stage: parsed.data.stage ?? 'prospect' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}
