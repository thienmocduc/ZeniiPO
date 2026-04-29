import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase/server'
import { safeString } from '@/lib/security/schemas'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const PatchSchema = z.object({
  full_name: safeString.max(120).optional(),
  avatar_url: safeString.optional(),
  locale: z.enum(['vi', 'en']).optional(),
})

export async function GET() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [profile, tenant] = await Promise.all([
    supabase.from('user_profiles').select('*').eq('id', user.id).maybeSingle(),
    (async () => {
      const p = await supabase.from('user_profiles').select('tenant_id').eq('id', user.id).maybeSingle()
      if (!p.data?.tenant_id) return { data: null }
      return supabase.from('tenants').select('id, name, slug, plan, created_at').eq('id', p.data.tenant_id).maybeSingle()
    })(),
  ])

  return NextResponse.json({
    data: {
      auth: { id: user.id, email: user.email, last_sign_in_at: user.last_sign_in_at },
      profile: profile.data,
      tenant: tenant.data,
    },
  })
}

export async function PATCH(req: Request) {
  const body = await req.json().catch(() => ({}))
  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('user_profiles')
    .update(parsed.data)
    .eq('id', user.id)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
