import type { SupabaseClient } from '@supabase/supabase-js'
import { chatComplete, isAIConfigured, FAST_MODEL } from './client'
import { computeCost } from './cost'
import { buildSystemPrompt, loadAgentFromCatalog } from './dispatcher'
import { getPlaybook, playbookToPrompt, ACTION_CONTRACT } from './playbooks'
import { buildTenantSnapshot } from './context-builder'
import { sanitizeAction, executeAction, type ProposedAction } from './action-executor'

/**
 * AGENT ENGINE — the autonomous heartbeat of the 108 Legion.
 *
 * Cron tick → due agent_schedules → for each: assemble tenant snapshot →
 * playbook-composed supagent run → parse structured {summary, insights,
 * actions} → persist run + memory → actions either auto-execute
 * (autonomy='auto') or land as proposals awaiting 1-click approval.
 *
 * Design guarantees:
 *  - graceful degradation: AI unconfigured → tick reports skipped (no error)
 *  - per-schedule isolation: one tenant/agent failure never blocks the rest
 *  - bounded cost: MAX_RUNS_PER_TICK caps each tick; context ≤ ~3k tokens
 *  - log_insight always auto-executes (harmless); risky types gate on
 *    autonomy — the human stays in the loop until they opt out per agent.
 */

const MAX_RUNS_PER_TICK = 6
const MAX_ACTIONS_PER_RUN = 5

const CADENCE_MS: Record<string, number> = {
  daily: 24 * 3600 * 1000,
  weekly: 7 * 24 * 3600 * 1000,
  monthly: 30 * 24 * 3600 * 1000,
}

type ScheduleRow = {
  id: string
  tenant_id: string
  agent_code: string
  cadence: string
  autonomy: 'propose' | 'auto'
}

type ParsedOutput = {
  summary?: string
  insights?: Array<{ title?: string; body?: string }>
  actions?: unknown[]
}

/** Tolerant JSON extraction — models occasionally wrap output in fences. */
export function parseAgentJson(text: string): ParsedOutput | null {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  try {
    return JSON.parse(text.slice(start, end + 1)) as ParsedOutput
  } catch {
    return null
  }
}

/**
 * Auto-provision default schedules: every tenant with an active IPO journey
 * gets its 12 chief supagents on a weekly cadence (staggered so one tick
 * never runs a whole tenant at once). Idempotent — skips tenants that
 * already have any schedule.
 */
export async function provisionDefaultSchedules(sb: SupabaseClient): Promise<number> {
  const { data: journeys } = await sb
    .from('ipo_journeys')
    .select('tenant_id')
    .eq('status', 'active')
  const tenantIds = [...new Set((journeys ?? []).map((j) => j.tenant_id as string))]
  if (tenantIds.length === 0) return 0

  const { data: existing } = await sb
    .from('agent_schedules')
    .select('tenant_id')
    .in('tenant_id', tenantIds)
  const has = new Set((existing ?? []).map((r) => r.tenant_id as string))

  const fresh = tenantIds.filter((t) => !has.has(t))
  if (fresh.length === 0) return 0

  const { data: chiefs } = await sb
    .from('agent_catalog')
    .select('agent_code')
    .eq('is_chief', true)
    .order('display_order', { ascending: true })
  if (!chiefs || chiefs.length === 0) return 0

  const rows = fresh.flatMap((tenantId) =>
    chiefs.map((c, idx) => ({
      tenant_id: tenantId,
      agent_code: c.agent_code as string,
      cadence: 'weekly',
      autonomy: 'propose',
      enabled: true,
      // Stagger: chief #idx first runs idx*2h from now.
      next_run_at: new Date(Date.now() + idx * 2 * 3600 * 1000).toISOString(),
    })),
  )
  const { error } = await sb.from('agent_schedules').insert(rows)
  return error ? 0 : rows.length
}

async function resolveTenantAgentIdService(
  sb: SupabaseClient,
  tenantId: string,
  agentCode: string,
): Promise<string | null> {
  const existing = await sb
    .from('agents')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('agent_code', agentCode)
    .maybeSingle()
  if (existing.data?.id) return existing.data.id as string

  const catalog = await loadAgentFromCatalog(agentCode, sb)
  const inserted = await sb
    .from('agents')
    .insert({
      tenant_id: tenantId,
      agent_code: catalog.agent_code,
      name: catalog.name,
      department: catalog.department,
      pantheon: catalog.pantheon,
      status: 'active',
    })
    .select('id')
    .single()
  return (inserted.data?.id as string) ?? null
}

export type ScheduleRunResult = {
  schedule_id: string
  tenant_id: string
  agent_code: string
  status: 'success' | 'failed'
  actions_proposed: number
  actions_executed: number
  error?: string
}

async function runOneSchedule(sb: SupabaseClient, sched: ScheduleRow): Promise<ScheduleRunResult> {
  const base: ScheduleRunResult = {
    schedule_id: sched.id,
    tenant_id: sched.tenant_id,
    agent_code: sched.agent_code,
    status: 'failed',
    actions_proposed: 0,
    actions_executed: 0,
  }

  const agent = await loadAgentFromCatalog(sched.agent_code, sb)
  const snapshot = await buildTenantSnapshot(sb, sched.tenant_id, sched.agent_code)
  const playbook = getPlaybook(agent.department)

  const system = `${buildSystemPrompt(agent)}

${playbookToPrompt(playbook)}

${ACTION_CONTRACT}`
  const user = `CONTEXT (JSON snapshot của doanh nghiệp, kỳ ${new Date().toISOString().slice(0, 10)}):
${JSON.stringify(snapshot)}

Thực hiện chu kỳ vận hành tự động của bạn theo playbook: phân tích context, rồi trả về JSON đúng contract.`

  const r = await chatComplete({ system, user, model: FAST_MODEL, maxTokens: 2048 })
  const parsed = parseAgentJson(r.text)

  const tenantAgentId = await resolveTenantAgentIdService(sb, sched.tenant_id, sched.agent_code)
  let cost = 0
  try {
    cost = computeCost({ input: r.inputTokens, output: r.outputTokens }, r.model)
  } catch {
    /* unknown model pricing */
  }

  let runId: string | null = null
  if (tenantAgentId) {
    const run = await sb
      .from('agent_runs')
      .insert({
        agent_id: tenantAgentId,
        triggered_by: null, // autonomous cron run
        input: { mode: 'engine', cadence: sched.cadence },
        output: { text: r.text.slice(0, 8000), structured: parsed ?? null },
        tokens_input: r.inputTokens,
        tokens_output: r.outputTokens,
        cost_usd: cost,
        duration_ms: 0,
        status: parsed ? 'success' : 'failed',
        error_message: parsed ? null : 'unparseable agent JSON',
      })
      .select('id')
      .single()
    runId = (run.data?.id as string) ?? null
    await sb.from('agents').update({ last_run_at: new Date().toISOString() }).eq('id', tenantAgentId)
  }

  if (!parsed) return { ...base, error: 'unparseable agent JSON' }

  // Persist cycle summary + insights into agent memory (the learning loop).
  const memRows: Array<Record<string, unknown>> = []
  if (parsed.summary && typeof parsed.summary === 'string') {
    memRows.push({
      tenant_id: sched.tenant_id,
      agent_code: sched.agent_code,
      kind: 'summary',
      title: `Chu kỳ ${new Date().toISOString().slice(0, 10)}`,
      body: parsed.summary.slice(0, 4000),
    })
  }
  for (const ins of (parsed.insights ?? []).slice(0, 4)) {
    if (ins?.title) {
      memRows.push({
        tenant_id: sched.tenant_id,
        agent_code: sched.agent_code,
        kind: 'insight',
        title: String(ins.title).slice(0, 300),
        body: ins.body ? String(ins.body).slice(0, 4000) : null,
      })
    }
  }
  if (memRows.length > 0) await sb.from('agent_memory').insert(memRows)

  // Actions: sanitize → auto-execute or propose.
  const actions: ProposedAction[] = (parsed.actions ?? [])
    .slice(0, MAX_ACTIONS_PER_RUN)
    .map(sanitizeAction)
    .filter((a): a is ProposedAction => a !== null)

  let proposed = 0
  let executed = 0
  for (const action of actions) {
    const autoRun = sched.autonomy === 'auto' || action.type === 'log_insight'
    if (autoRun) {
      const res = await executeAction(sb, sched.tenant_id, sched.agent_code, action)
      await sb.from('agent_actions').insert({
        tenant_id: sched.tenant_id,
        run_id: runId,
        agent_code: sched.agent_code,
        action_type: action.type,
        title: action.title,
        payload: action.payload,
        confidence: action.confidence ?? null,
        status: res.ok ? 'executed' : 'failed',
        executed_at: new Date().toISOString(),
        result: res.result ?? null,
        error_message: res.error ?? null,
      })
      if (res.ok) executed += 1
    } else {
      await sb.from('agent_actions').insert({
        tenant_id: sched.tenant_id,
        run_id: runId,
        agent_code: sched.agent_code,
        action_type: action.type,
        title: action.title,
        payload: action.payload,
        confidence: action.confidence ?? null,
        status: 'proposed',
      })
      proposed += 1
    }
  }

  return { ...base, status: 'success', actions_proposed: proposed, actions_executed: executed }
}

export type EngineTickResult = {
  skipped?: string
  provisioned?: number
  due?: number
  ran?: number
  ok?: number
  failed?: number
  results?: ScheduleRunResult[]
}

/** One engine heartbeat — called by /api/cron/agents. */
export async function tickAgentEngine(sb: SupabaseClient): Promise<EngineTickResult> {
  if (!isAIConfigured()) {
    return { skipped: 'ai_not_configured' }
  }

  const provisioned = await provisionDefaultSchedules(sb)

  const { data: due, error } = await sb
    .from('agent_schedules')
    .select('id, tenant_id, agent_code, cadence, autonomy')
    .eq('enabled', true)
    .lte('next_run_at', new Date().toISOString())
    .order('next_run_at', { ascending: true })
    .limit(MAX_RUNS_PER_TICK)
  if (error) return { provisioned, due: 0, ran: 0, ok: 0, failed: 0, results: [] }

  const results: ScheduleRunResult[] = []
  for (const sched of (due ?? []) as ScheduleRow[]) {
    let res: ScheduleRunResult
    try {
      res = await runOneSchedule(sb, sched)
    } catch (err) {
      res = {
        schedule_id: sched.id,
        tenant_id: sched.tenant_id,
        agent_code: sched.agent_code,
        status: 'failed',
        actions_proposed: 0,
        actions_executed: 0,
        error: err instanceof Error ? err.message.slice(0, 300) : 'run failed',
      }
    }
    // Always advance next_run_at — a failing agent must not wedge the queue.
    const interval = CADENCE_MS[sched.cadence] ?? CADENCE_MS.weekly
    await sb
      .from('agent_schedules')
      .update({
        last_run_at: new Date().toISOString(),
        next_run_at: new Date(Date.now() + interval).toISOString(),
      })
      .eq('id', sched.id)
    results.push(res)
  }

  return {
    provisioned,
    due: due?.length ?? 0,
    ran: results.length,
    ok: results.filter((r) => r.status === 'success').length,
    failed: results.filter((r) => r.status === 'failed').length,
    results,
  }
}
