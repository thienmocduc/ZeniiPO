import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { requireUserAndTenant } from '@/lib/api/tenant'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// CSV export of the audit trail. Only chr/ceo/auditor roles can export.
export async function GET(req: Request) {
  const supabase = await createServerClient()
  const auth = await requireUserAndTenant(supabase)
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status })

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', auth.user.id)
    .maybeSingle()
  const role = profile?.role
  if (!role || !['chr', 'ceo', 'auditor'].includes(role)) {
    return NextResponse.json({ error: 'Only chairman/CEO/auditor can export audit log' }, { status: 403 })
  }

  const url = new URL(req.url)
  const limit = Math.min(10_000, Number(url.searchParams.get('limit') ?? 5000))
  const action = url.searchParams.get('action')
  const targetTable = url.searchParams.get('target_table')
  const fromDate = url.searchParams.get('from') // ISO yyyy-mm-dd
  const toDate = url.searchParams.get('to')

  let q = supabase.from('audit_logs').select('id, action, target_table, target_id, actor_id, ip_address, user_agent, created_at')
  if (action) q = q.eq('action', action)
  if (targetTable) q = q.eq('target_table', targetTable)
  if (fromDate) q = q.gte('created_at', `${fromDate}T00:00:00Z`)
  if (toDate) q = q.lte('created_at', `${toDate}T23:59:59Z`)
  q = q.order('created_at', { ascending: false }).limit(limit)
  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // CSV escape RFC 4180: wrap in quotes, double internal quotes.
  const esc = (v: unknown) => {
    if (v == null) return ''
    const s = String(v)
    return `"${s.replace(/"/g, '""')}"`
  }
  const header = 'created_at,action,target_table,target_id,actor_id,ip_address,user_agent'
  const rows = (data ?? []).map((r) => {
    const row = r as Record<string, unknown>
    return [row.created_at, row.action, row.target_table, row.target_id, row.actor_id, row.ip_address, row.user_agent].map(esc).join(',')
  })
  const csv = [header, ...rows].join('\n') + '\n'

  const fname = `audit-${new Date().toISOString().slice(0, 10)}.csv`
  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${fname}"`,
      'Cache-Control': 'no-store',
    },
  })
}
