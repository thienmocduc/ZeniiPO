import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase/server'
import { requireUserAndTenant } from '@/lib/api/tenant'
import { isAnthropicConfigured } from '@/lib/agents/client'
import { parseNlqQuery, NLQ_TABLES, type NlqTable } from '@/lib/agents/nlq'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// GET — recent query history (used by /nl-query page).
export async function GET(req: Request) {
  const supabase = await createServerClient()
  const auth = await requireUserAndTenant(supabase)
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status })

  const url = new URL(req.url)
  const limit = Math.min(100, Number(url.searchParams.get('limit') ?? 25))
  const { data, error } = await supabase
    .from('nlq_logs')
    .select('id, query_text, query_intent, result_summary, status, duration_ms, cost_usd, created_at')
    .eq('tenant_id', auth.tenantId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

// POST — translate question via Claude → execute as scoped Supabase query → log.
const PostSchema = z.object({
  query_text: z.string().trim().min(2).max(2000),
})

export async function POST(req: Request) {
  if (!isAnthropicConfigured()) {
    return NextResponse.json(
      { error: 'NLQ unavailable — ANTHROPIC_API_KEY not configured' },
      { status: 503 },
    )
  }

  const body = await req.json().catch(() => ({}))
  const parsed = PostSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const supabase = await createServerClient()
  const auth = await requireUserAndTenant(supabase)
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status })

  const startedAt = Date.now()
  const nlq = await parseNlqQuery(parsed.data.query_text)

  // Claude could not produce a valid intent → log error + return 422.
  if (!nlq.intent) {
    await supabase.from('nlq_logs').insert({
      tenant_id: auth.tenantId,
      user_id: auth.user.id,
      query_text: parsed.data.query_text,
      agent_model: nlq.model,
      tokens_input: nlq.tokens_input,
      tokens_output: nlq.tokens_output,
      cost_usd: nlq.cost_usd,
      duration_ms: Date.now() - startedAt,
      status: 'error',
      error_message: nlq.error?.slice(0, 500) ?? 'Unknown',
    })
    return NextResponse.json({ error: nlq.error ?? 'Could not parse query' }, { status: 422 })
  }

  // Execute the validated intent through supabase-js so RLS applies normally.
  const intent = nlq.intent
  const allowed = NLQ_TABLES[intent.table as NlqTable] as readonly string[]
  const select = intent.columns === '*' ? allowed.join(',') : intent.columns.join(',')
  let q = supabase.from(intent.table).select(select)
  for (const f of intent.filters ?? []) {
    const v = f.value
    switch (f.op) {
      case 'eq': q = q.eq(f.column, v as string | number | boolean); break
      case 'gt': q = q.gt(f.column, v as string | number); break
      case 'gte': q = q.gte(f.column, v as string | number); break
      case 'lt': q = q.lt(f.column, v as string | number); break
      case 'lte': q = q.lte(f.column, v as string | number); break
      case 'ilike': q = q.ilike(f.column, String(v)); break
      case 'in': q = q.in(f.column, Array.isArray(v) ? v : [v as string]); break
    }
  }
  if (intent.order_by) q = q.order(intent.order_by.column, { ascending: intent.order_by.ascending })
  q = q.limit(intent.limit ?? 50)

  const { data, error } = await q
  const durationMs = Date.now() - startedAt

  if (error) {
    await supabase.from('nlq_logs').insert({
      tenant_id: auth.tenantId,
      user_id: auth.user.id,
      query_text: parsed.data.query_text,
      query_intent: intent.intent_summary,
      resolved_sql: `SELECT ${select} FROM ${intent.table} -- ${JSON.stringify(intent.filters ?? [])}`,
      agent_model: nlq.model,
      tokens_input: nlq.tokens_input,
      tokens_output: nlq.tokens_output,
      cost_usd: nlq.cost_usd,
      duration_ms: durationMs,
      status: 'error',
      error_message: error.message.slice(0, 500),
    })
    return NextResponse.json({ error: error.message, intent }, { status: 500 })
  }

  const summary = `${data?.length ?? 0} dòng từ ${intent.table}`
  await supabase.from('nlq_logs').insert({
    tenant_id: auth.tenantId,
    user_id: auth.user.id,
    query_text: parsed.data.query_text,
    query_intent: intent.intent_summary,
    resolved_sql: `SELECT ${select} FROM ${intent.table} -- ${JSON.stringify(intent.filters ?? [])}`,
    result_summary: summary,
    result_json: data,
    agent_model: nlq.model,
    tokens_input: nlq.tokens_input,
    tokens_output: nlq.tokens_output,
    cost_usd: nlq.cost_usd,
    duration_ms: durationMs,
    status: 'success',
  })

  return NextResponse.json({
    data: {
      intent,
      rows: data,
      summary,
      meta: {
        model: nlq.model,
        tokens_input: nlq.tokens_input,
        tokens_output: nlq.tokens_output,
        cost_usd: nlq.cost_usd,
        duration_ms: durationMs,
      },
    },
  })
}
