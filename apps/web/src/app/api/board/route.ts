import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { requireUserAndTenant } from '@/lib/api/tenant'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const BOARD_ROLES = ['chr', 'ceo', 'board', 'investor']

export async function GET() {
  const supabase = await createServerClient()
  const auth = await requireUserAndTenant(supabase)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status })
  }
  const { data, error } = await supabase
    .from('user_profiles')
    .select('id, full_name, email, role, last_active_at, created_at')
    .in('role', BOARD_ROLES)
    .order('created_at', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
