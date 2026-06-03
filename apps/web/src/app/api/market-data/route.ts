import { z } from 'zod'
import { createCrudHandler } from '@/lib/api/crud'
import { safeString } from '@/lib/security/schemas'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const Schema = z.object({
  metric_type: z.enum(['tam','sam','som','growth_rate','penetration','share','competitor_count','arpu','market_size']),
  region: safeString.optional(),
  segment: safeString.optional(),
  value_numeric: z.number().optional(),
  value_unit: safeString.optional(),
  currency: safeString.optional(),
  period_start: safeString.optional(),
  period_end: safeString.optional(),
  source: safeString.optional(),
  source_url: safeString.optional(),
  confidence: z.enum(['low','medium','high','verified']).optional(),
  notes: safeString.optional(),
})

export const { GET, POST } = createCrudHandler({
  table: 'market_data',
  searchableColumns: ['metric_type', 'region', 'segment'],
  createSchema: Schema,
})
