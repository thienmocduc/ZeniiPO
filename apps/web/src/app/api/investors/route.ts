import { z } from 'zod'
import { createCrudHandler } from '@/lib/api/crud'
import { safeString } from '@/lib/security/schemas'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Reuses investor_pipeline (created in migration 003).
const Schema = z.object({
  investor_name: safeString.min(1),
  investor_type: safeString.optional(),
  firm_name: safeString.optional(),
  contact_name: safeString.optional(),
  contact_email: safeString.optional(),
  contact_linkedin: safeString.optional(),
  stage: safeString.optional(),
  priority: safeString.optional(),
  target_check_usd: z.number().optional(),
  committed_usd: z.number().optional(),
  probability_pct: z.number().optional(),
  next_action: safeString.optional(),
  next_action_date: safeString.optional(),
  notes: safeString.optional(),
})

export const { GET, POST } = createCrudHandler({
  table: 'investor_pipeline',
  searchableColumns: ['stage', 'priority', 'investor_type'],
  createSchema: Schema,
})
