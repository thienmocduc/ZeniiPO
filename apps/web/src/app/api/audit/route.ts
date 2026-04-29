import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { requireUserAndTenant } from '@/lib/api/tenant'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Read-only audit trail. Inserts happen via DB triggers on sensitive tables.
export async function GET(req: Request) {
  const supabase = await createServerClient()
  const auth = await requireUserAndTenant(supabase)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status })
  }

  const url = new URL(req.url)
  const limit = Math.min(500, Number(url.searchParams.get('limit') ?? 100))
  const action = url.searchParams.get('action')
  const tableName = url.searchParams.get('target_table')

  let q = supabase.from('audit_logs').select('*')
  if (action) q = q.eq('action', action)
  if (tableName) q = q.eq('target_table', tableName)
  q = q.order('created_at', { ascending: false }).limit(limit)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
