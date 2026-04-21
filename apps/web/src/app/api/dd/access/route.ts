import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase/server'
import { getCurrentTenantId } from '@/lib/api/tenant'
import { safeEmail, safeString, safeUuid } from '@/lib/security/schemas'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const InviteSchema = z.object({
  investor_email: safeEmail,
  investor_name: safeString.min(1),
  nda_accepted: z.boolean().optional(),
  folder_scopes: z.array(safeString).min(1),
  expires_at: safeString.optional(),
  round_id: safeUuid.optional().nullable(),
})

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const parsed = InviteSchema.safeParse(body)
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
    .from('dd_investor_access')
    .insert({
      tenant_id: tenantId,
      investor_email: parsed.data.investor_email,
      investor_name: parsed.data.investor_name,
      nda_accepted: parsed.data.nda_accepted ?? false,
      folder_scopes: parsed.data.folder_scopes,
      expires_at: parsed.data.expires_at,
      round_id: parsed.data.round_id,
      invited_by: user.id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}

export async function GET() {
  const supabase = createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('dd_investor_access')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
