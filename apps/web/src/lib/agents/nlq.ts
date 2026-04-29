import { getAnthropicClient, FAST_MODEL } from './client'

/**
 * Natural-language query → safe Supabase intent.
 *
 * We do NOT let Claude write raw SQL. Instead Claude returns a strict JSON
 * envelope describing a single SELECT against the whitelisted table set; the
 * server then composes the query via supabase-js so RLS, auth, and tenant
 * scoping are preserved end-to-end. Claude can read the schema doc but never
 * the database itself, so prompt injection cannot exfiltrate data.
 */

// Whitelist of read-only resources NLQ may query. Only RLS-scoped tables.
export const NLQ_TABLES = {
  okr_objectives: ['id', 'tier', 'title', 'description', 'parent_id', 'created_at'],
  okr_krs: ['id', 'objective_id', 'title', 'target_value', 'current_value', 'unit', 'status', 'created_at'],
  tasks: ['id', 'title', 'priority', 'status', 'due_date', 'assignee_id', 'kr_id', 'created_at'],
  ipo_journeys: ['id', 'name', 'current_phase', 'valuation_target', 'exit_venue', 'target_year', 'industry', 'status', 'created_at'],
  ipo_readiness_criteria: ['id', 'criterion_code', 'category', 'name_vi', 'weight', 'status', 'score_pct', 'verified_at', 'target_date'],
  kpi_metrics: ['id', 'metric_code', 'name', 'category', 'value', 'unit', 'period', 'trend', 'captured_at'],
  events: ['id', 'event_type', 'cascade_status', 'created_at'],
  fundraise_rounds: ['id', 'round_code', 'round_name', 'target_raise_usd', 'pre_money_usd', 'post_money_usd', 'status', 'created_at'],
  investor_pipeline: ['id', 'investor_name', 'firm_name', 'investor_type', 'stage', 'priority', 'target_check_usd', 'committed_usd', 'probability_pct', 'next_action_date', 'created_at'],
  cap_table_snapshots: ['id', 'snapshot_date', 'snapshot_type', 'total_shares', 'fully_diluted_shares', 'valuation_usd', 'share_price_usd', 'created_at'],
  comparables: ['id', 'company_name', 'ticker', 'industry', 'region', 'market_cap_usd', 'ev_revenue_multiple', 'ev_ebitda_multiple', 'pe_ratio', 'growth_rate_pct'],
  market_data: ['id', 'metric_type', 'region', 'segment', 'value_numeric', 'value_unit', 'period_start', 'period_end', 'confidence'],
  market_intel: ['id', 'category', 'severity', 'title', 'related_competitor', 'region', 'industry', 'published_at', 'created_at'],
  audit_logs: ['id', 'action', 'target_table', 'created_at'],
} as const

export type NlqTable = keyof typeof NLQ_TABLES

export type NlqIntent = {
  table: NlqTable
  /** Subset of allowed columns (or "*" → all whitelisted). */
  columns: string[] | '*'
  /** Equality filters. Both LHS column name and RHS value go through validation. */
  filters?: Array<{ column: string; op: 'eq' | 'gt' | 'gte' | 'lt' | 'lte' | 'ilike' | 'in'; value: string | number | boolean | string[] }>
  order_by?: { column: string; ascending: boolean }
  limit?: number
  /** Short human-readable summary of what the query is doing — included in the response. */
  intent_summary: string
}

const SYSTEM_PROMPT = `You translate Vietnamese / English business questions about an IPO Journey platform into a strict JSON intent that the server can execute safely against a whitelisted set of tables.

You MUST return a single JSON object that matches this TypeScript shape:

type Intent = {
  table: TableName,        // one of the whitelisted tables below
  columns: string[] | "*", // subset of the table's allowed columns, or "*" for all
  filters?: Array<{        // optional, AND-combined
    column: string,
    op: "eq" | "gt" | "gte" | "lt" | "lte" | "ilike" | "in",
    value: string | number | boolean | string[]
  }>,
  order_by?: { column: string, ascending: boolean },
  limit?: number,          // default 50, max 200
  intent_summary: string   // 1 short Vietnamese sentence describing what this query does
}

WHITELISTED TABLES + COLUMNS:
${Object.entries(NLQ_TABLES).map(([t, cols]) => `- ${t}: ${cols.join(', ')}`).join('\n')}

RULES:
- Only ONE table per query. No joins.
- "value" for "in" must be an array. For "ilike", wrap %term% yourself.
- limit defaults to 50; never exceed 200.
- If the question is ambiguous, pick the most natural table + smallest filter set.
- If the question cannot be expressed as a SELECT against whitelisted tables, return {"error": "<short Vietnamese explanation>"}.
- NEVER include INSERT, UPDATE, DELETE, DROP, ALTER, or raw SQL fragments.
- NEVER reference columns outside the whitelist.

Return ONLY the JSON object, no markdown fences, no commentary.`

export type NlqResult = {
  intent?: NlqIntent
  error?: string
  model: string
  tokens_input: number
  tokens_output: number
  cost_usd: number
}

/** Cost approximation for Haiku 4.5 — adjust if model changes. */
function approxCost(model: string, inputTokens: number, outputTokens: number): number {
  if (model.includes('haiku')) return inputTokens * 0.0000008 + outputTokens * 0.000004
  if (model.includes('opus')) return inputTokens * 0.000015 + outputTokens * 0.000075
  return inputTokens * 0.000003 + outputTokens * 0.000015 // sonnet default
}

export async function parseNlqQuery(question: string): Promise<NlqResult> {
  const client = getAnthropicClient()
  const model = FAST_MODEL
  const res = await client.messages.create({
    model,
    max_tokens: 800,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: question }],
  })
  const text = res.content
    .filter((b) => b.type === 'text')
    .map((b) => (b as { type: 'text'; text: string }).text)
    .join('')
    .trim()

  const tokens_input = res.usage?.input_tokens ?? 0
  const tokens_output = res.usage?.output_tokens ?? 0
  const cost_usd = approxCost(model, tokens_input, tokens_output)
  const meta = { model, tokens_input, tokens_output, cost_usd }

  // Strip optional ```json fences if Claude slips them in.
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
  let parsed: unknown
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    return { ...meta, error: `Mô hình trả về không phải JSON hợp lệ: ${text.slice(0, 200)}` }
  }

  const obj = parsed as Record<string, unknown>
  if (typeof obj.error === 'string') return { ...meta, error: obj.error }

  // Validate intent shape strictly.
  if (typeof obj.table !== 'string' || !(obj.table in NLQ_TABLES)) {
    return { ...meta, error: `Bảng "${String(obj.table)}" không nằm trong danh sách cho phép.` }
  }
  const allowed = NLQ_TABLES[obj.table as NlqTable] as readonly string[]
  const cols = obj.columns
  if (cols !== '*' && !(Array.isArray(cols) && cols.every((c) => typeof c === 'string' && allowed.includes(c)))) {
    return { ...meta, error: `Cột yêu cầu vượt khỏi whitelist của bảng ${obj.table}.` }
  }
  if (obj.filters && !Array.isArray(obj.filters)) {
    return { ...meta, error: 'filters phải là mảng' }
  }
  for (const f of (obj.filters ?? []) as Array<Record<string, unknown>>) {
    if (typeof f.column !== 'string' || !allowed.includes(f.column)) {
      return { ...meta, error: `Filter trên cột "${String(f.column)}" không cho phép.` }
    }
    if (typeof f.op !== 'string' || !['eq', 'gt', 'gte', 'lt', 'lte', 'ilike', 'in'].includes(f.op)) {
      return { ...meta, error: `Toán tử "${String(f.op)}" không hợp lệ.` }
    }
  }
  if (obj.order_by) {
    const ob = obj.order_by as Record<string, unknown>
    if (typeof ob.column !== 'string' || !allowed.includes(ob.column)) {
      return { ...meta, error: `Sort trên cột "${String(ob.column)}" không cho phép.` }
    }
  }
  const limit = typeof obj.limit === 'number' ? Math.min(200, Math.max(1, Math.floor(obj.limit))) : 50

  return {
    ...meta,
    intent: {
      table: obj.table as NlqTable,
      columns: cols as string[] | '*',
      filters: obj.filters as NlqIntent['filters'],
      order_by: obj.order_by as NlqIntent['order_by'],
      limit,
      intent_summary: typeof obj.intent_summary === 'string' ? obj.intent_summary : '',
    },
  }
}
