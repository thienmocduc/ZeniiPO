import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { requireUserAndTenant } from '@/lib/api/tenant'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  const supabase = await createServerClient()
  const auth = await requireUserAndTenant(supabase)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status })
  }
  const [members, invites] = await Promise.all([
    supabase
      .from('user_profiles')
      .select('id, full_name, email, role, avatar_url, last_active_at, created_at')
      .order('created_at', { ascending: true }),
    supabase
      .from('invitations')
      .select('id, email, role, expires_at, accepted_at, created_at')
      .order('created_at', { ascending: false })
      .limit(50),
  ])
  if (members.error) return NextResponse.json({ error: members.error.message }, { status: 500 })
  return NextResponse.json({ data: { members: members.data ?? [], invites: invites.data ?? [] } })
}
