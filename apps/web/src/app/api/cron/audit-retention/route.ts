import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { isAuthorizedCron } from '@/lib/cron/auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Daily at 02:00 SGT — delete audit_logs older than 7 years (compliance default).
 * Adjust AUDIT_RETENTION_DAYS env var for a different window.
 */
const RETENTION_DAYS = Number(process.env.AUDIT_RETENTION_DAYS ?? 7 * 365)

export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const sb = createServiceClient()
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 86_400_000).toISOString()

  // Count first so we log how many rows the cron would delete.
  const { count: toDelete, error: countErr } = await sb
    .from('audit_logs')
    .select('id', { count: 'exact', head: true })
    .lt('created_at', cutoff)
  if (countErr) {
    return NextResponse.json({ error: countErr.message }, { status: 500 })
  }

  const { error } = await sb.from('audit_logs').delete().lt('created_at', cutoff)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    data: {
      deleted_count: toDelete ?? 0,
      cutoff,
      retention_days: RETENTION_DAYS,
    },
  })
}
