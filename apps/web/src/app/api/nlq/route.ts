import { z } from 'zod'
import { createCrudHandler } from '@/lib/api/crud'
import { safeString } from '@/lib/security/schemas'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// NL Query — accepts free-text query, logs to nlq_logs, returns recent log.
// Anthropic wire-up happens in chunk 7.
const Schema = z.object({
  query_text: safeString.min(2).max(2000),
  query_intent: safeString.optional(),
  result_summary: safeString.optional(),
  result_json: z.unknown().optional(),
})

export const { GET, POST } = createCrudHandler({
  table: 'nlq_logs',
  select: 'id, query_text, query_intent, result_summary, status, duration_ms, created_at',
  searchableColumns: ['status'],
  createSchema: Schema,
  beforeInsert: (payload, { userId }) => ({ ...payload, user_id: userId }),
})
