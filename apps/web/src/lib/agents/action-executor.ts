import { z } from 'zod'
import type { ZeniClient } from '@/lib/zeni/compat'

/**
 * Action executor Ã¢â‚¬â€ the ONLY path from agent output to database writes.
 *
 * Security model:
 *  - whitelisted action types only (CHECK constraint mirrors this list)
 *  - every payload zod-validated before touching a table
 *  - all writes carry tenant_id explicitly; callers pass an RLS-scoped SSR
 *    client (user approval path) or the service client (autonomy='auto'
 *    cron path) Ã¢â‚¬â€ both end up tenant-scoped because we set tenant_id here
 *    and RLS/CHECKs re-verify on the user path.
 */

export const ActionType = z.enum(['create_task', 'upsert_kpi', 'raise_alert', 'log_insight'])
export type ActionTypeT = z.infer<typeof ActionType>

const CreateTaskPayload = z.object({
  title: z.string().trim().min(1).max(300),
  description: z.string().trim().max(2000).optional(),
  priority: z.enum(['t1', 't2', 't3']).optional(),
  due_days: z.number().int().min(1).max(90).optional(),
})

const UpsertKpiPayload = z.object({
  metric_code: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9_]+$/, 'snake_case only'),
  name: z.string().trim().min(1).max(200),
  value: z.number().finite(),
  unit: z.string().trim().max(32).optional(),
  period: z.string().trim().max(32).optional(),
  trend: z.enum(['up', 'down', 'flat']).optional(),
})

const RaiseAlertPayload = z.object({
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  title: z.string().trim().min(1).max(300),
  body: z.string().trim().max(2000).optional(),
})

const LogInsightPayload = z.object({
  title: z.string().trim().min(1).max(300),
  body: z.string().trim().min(1).max(4000),
})

export const PAYLOAD_SCHEMAS: Record<ActionTypeT, z.ZodTypeAny> = {
  create_task: CreateTaskPayload,
  upsert_kpi: UpsertKpiPayload,
  raise_alert: RaiseAlertPayload,
  log_insight: LogInsightPayload,
}

export type ProposedAction = {
  type: ActionTypeT
  title: string
  confidence?: number
  payload: Record<string, unknown>
}

/** Parse + validate one raw action from LLM output. Returns null if invalid. */
export function sanitizeAction(raw: unknown): ProposedAction | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const type = ActionType.safeParse(r.type)
  if (!type.success) return null
  const payload = PAYLOAD_SCHEMAS[type.data].safeParse(r.payload)
  if (!payload.success) return null
  const title = typeof r.title === 'string' && r.title.trim() ? r.title.trim().slice(0, 300) : null
  if (!title) return null
  const confidence =
    typeof r.confidence === 'number' && r.confidence >= 0 && r.confidence <= 1
      ? r.confidence
      : undefined
  return { type: type.data, title, confidence, payload: payload.data as Record<string, unknown> }
}

export type ExecutionResult = { ok: boolean; result?: Record<string, unknown>; error?: string }

/**
 * Execute a validated action against tenant data. Never throws Ã¢â‚¬â€ returns
 * {ok:false,error} so callers can mark the agent_actions row 'failed'.
 */
export async function executeAction(
  sb: ZeniClient,
  tenantId: string,
  agentCode: string,
  action: ProposedAction,
): Promise<ExecutionResult> {
  try {
    switch (action.type) {
      case 'create_task': {
        const p = CreateTaskPayload.parse(action.payload)
        const due = p.due_days
          ? new Date(Date.now() + p.due_days * 24 * 3600 * 1000).toISOString().slice(0, 10)
          : null
        const { data, error } = await sb
          .from('tasks')
          .insert({
            tenant_id: tenantId,
            title: p.title,
            description: p.description ?? `Ã„ÂÃ¡Â»Â xuÃ¡ÂºÂ¥t bÃ¡Â»Å¸i supagent ${agentCode}`,
            priority: p.priority ?? 't2',
            status: 'todo',
            due_date: due,
            agent_generated: true,
            metadata: { agent_code: agentCode },
          })
          .select('id')
          .single()
        if (error) return { ok: false, error: error.message }
        return { ok: true, result: { task_id: data.id } }
      }
      case 'upsert_kpi': {
        const p = UpsertKpiPayload.parse(action.payload)
        // Append-only series (matches /api/kpis POST) Ã¢â‚¬â€ history preserved,
        // dashboards read latest row per metric_code.
        const { data, error } = await sb
          .from('kpi_metrics')
          .insert({ ...p, tenant_id: tenantId })
          .select('id')
          .single()
        if (error) return { ok: false, error: error.message }
        return { ok: true, result: { kpi_id: data.id } }
      }
      case 'raise_alert': {
        const p = RaiseAlertPayload.parse(action.payload)
        const { data, error } = await sb
          .from('feedback_items')
          .insert({
            tenant_id: tenantId,
            category: 'other',
            severity: p.severity,
            title: `[AGENTÃ‚Â·${agentCode}] ${p.title}`,
            body: p.body ?? null,
            page_path: 'agent-engine',
          })
          .select('id')
          .single()
        if (error) return { ok: false, error: error.message }
        return { ok: true, result: { feedback_id: data.id } }
      }
      case 'log_insight': {
        const p = LogInsightPayload.parse(action.payload)
        const { data, error } = await sb
          .from('agent_memory')
          .insert({
            tenant_id: tenantId,
            agent_code: agentCode,
            kind: 'insight',
            title: p.title,
            body: p.body,
          })
          .select('id')
          .single()
        if (error) return { ok: false, error: error.message }
        return { ok: true, result: { memory_id: data.id } }
      }
    }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'execute failed' }
  }
}
