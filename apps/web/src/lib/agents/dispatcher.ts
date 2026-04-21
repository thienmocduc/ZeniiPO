import { createServerClient } from '@/lib/supabase/server'
import { DEFAULT_MODEL, FAST_MODEL, getAnthropicClient } from './client'
import { computeCost } from './cost'
import type { AgentCatalogRow, AgentRunInput, AgentRunOutput } from './types'

/**
 * Agent Legion dispatcher.
 *
 * Looks up an agent by `agent_code` in the `agent_catalog` table, composes a
 * system prompt from the agent's identity (name + pantheon + department +
 * role_description), calls Claude with the user prompt + optional context,
 * and returns the completion plus cost tracking.
 *
 * Note on clients: `agent_catalog` has RLS policy
 * `agent_catalog_public_read USING (true)` (migration 004), so the SSR client
 * (anon key) can read it. We intentionally do NOT require a service-role
 * client here — keeps env simple and avoids a privileged key in this path.
 * If we later add per-tenant agent restrictions on the catalog, we can switch.
 *
 * TODO Q2/2026: prompt caching via `cache_control` on the system prompt.
 *   Each agent's system prompt is static per agent_code — perfect for the
 *   1h cache tier. Expected ~85% input-token discount on repeated calls.
 */

function pickModel(mode: AgentRunInput['mode']): string {
  if (mode === 'fast') return FAST_MODEL
  // 'deep' and 'standard' both map to Opus for now; 'deep' is reserved for
  // future extended-thinking / multi-turn planning flows.
  return DEFAULT_MODEL
}

function buildSystemPrompt(agent: AgentCatalogRow): string {
  const chiefNote = agent.is_chief
    ? `You are the CHIEF agent for the ${agent.department} department — you lead the nine-agent department squad.\n`
    : ''
  const role = agent.role_description?.trim() || `${agent.department} specialist.`

  return `You are ${agent.name}, a ${agent.pantheon} pantheon agent in the Zeniipo 108 Agent Legion.
Department: ${agent.department}
Agent code: ${agent.agent_code}
Role: ${role}
${chiefNote}
Respond in the voice of ${agent.name} — concise, expert, action-oriented. Ground every answer in ${agent.department} best practice. When uncertain, say so explicitly rather than speculate. Prefer numbered lists and concrete next steps over prose. Output plain text (no markdown fences, no JSON) unless the user prompt explicitly asks for structured output.`
}

function buildUserPrompt(input: AgentRunInput): string {
  if (!input.context || Object.keys(input.context).length === 0) {
    return input.prompt
  }
  return `${input.prompt}\n\n---\nCONTEXT (JSON):\n${JSON.stringify(input.context, null, 2)}`
}

/**
 * Fetches catalog metadata for an agent. Accepts either the `agent_code`
 * string (e.g. `fin-01-plutus`) — this is what the catalog exposes.
 */
async function loadAgentFromCatalog(
  agentCode: string,
): Promise<AgentCatalogRow> {
  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('agent_catalog')
    .select(
      'agent_code, name, pantheon, department, role_description, is_chief, display_order',
    )
    .eq('agent_code', agentCode)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to load agent ${agentCode}: ${error.message}`)
  }
  if (!data) {
    throw new Error(`Agent not found in catalog: ${agentCode}`)
  }
  return data as AgentCatalogRow
}

/**
 * Dispatches a single agent run.
 *
 * Does NOT log to `agent_runs` — that's the route handler's job (it has the
 * tenant_id + user_id context and can attach errors to the row). Keeps this
 * function pure and testable.
 */
export async function runAgent(
  agentCode: string,
  input: AgentRunInput,
): Promise<AgentRunOutput> {
  const started = Date.now()
  const agent = await loadAgentFromCatalog(agentCode)

  const client = getAnthropicClient()
  const model = pickModel(input.mode)

  const message = await client.messages.create({
    model,
    max_tokens: input.mode === 'fast' ? 1024 : 2048,
    system: buildSystemPrompt(agent),
    messages: [{ role: 'user', content: buildUserPrompt(input) }],
  })

  const text = message.content
    .filter((block): block is { type: 'text'; text: string } => block.type === 'text')
    .map((block) => block.text)
    .join('')

  const tokens = {
    input: message.usage?.input_tokens ?? 0,
    output: message.usage?.output_tokens ?? 0,
  }

  return {
    text,
    tokens,
    cost_usd: computeCost(tokens, model),
    duration_ms: Date.now() - started,
  }
}

/**
 * Lookup helper exposed for route handlers that need to resolve a
 * tenant-scoped `agents.id` from a catalog `agent_code` (for the FK on
 * `agent_runs.agent_id`). Upserts a per-tenant row if missing.
 */
export async function resolveTenantAgentId(
  tenantId: string,
  agentCode: string,
): Promise<string> {
  const supabase = await createServerClient()

  // Try existing row first.
  const existing = await supabase
    .from('agents')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('agent_code', agentCode)
    .maybeSingle()

  if (existing.data?.id) return existing.data.id as string

  // Lazily create from catalog metadata.
  const catalog = await loadAgentFromCatalog(agentCode)
  const inserted = await supabase
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

  if (inserted.error || !inserted.data) {
    throw new Error(
      `Failed to provision tenant agent for ${agentCode}: ${inserted.error?.message ?? 'unknown'}`,
    )
  }
  return inserted.data.id as string
}
