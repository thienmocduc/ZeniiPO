import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { isAuthorizedCron } from '@/lib/cron/auth'
import { tickAgentEngine } from '@/lib/agents/engine'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300

/**
 * Agent Engine heartbeat — every 15 minutes.
 *
 * Runs due agent_schedules (max 6/tick to bound cost + duration):
 * provision default chief schedules for new tenants, execute each due
 * supagent cycle, store runs/memory, and land actions as proposals or
 * auto-executed writes per the schedule's autonomy setting.
 */
export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const sb = createServiceClient()
  const result = await tickAgentEngine(sb)
  return NextResponse.json({ data: result })
}
