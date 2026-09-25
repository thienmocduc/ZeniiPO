import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase/server'
import { getCurrentTenantId } from '@/lib/api/tenant'
import { safeEmail, safeString } from '@/lib/security/schemas'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const InviteSchema = z.object({
  role: z.enum(['lawyer', 'auditor', 'underwriter', 'investor', 'board_member', 'advisor', 'banker', 'consultant']),
  name: safeString.min(1),
  email: safeEmail,
  organization: safeString.optional(),
  scope: safeString.optional(),
})

export async function GET() {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('external_stakeholders')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const parsed = InviteSchema.safeParse(body)
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

  const { data, error } = await supabase
    .from('external_stakeholders')
    .insert({
      // Khớp đúng cột `external_stakeholders`: name → full_name,
      // organization → firm_name, scope → scope_permissions.
      tenant_id: tenantId,
      role: parsed.data.role,
      full_name: parsed.data.name,
      email: parsed.data.email,
      firm_name: parsed.data.organization,
      scope_permissions: parsed.data.scope,
      invited_by: user.id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}
