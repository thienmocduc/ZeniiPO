import { z } from 'zod'
import { createCrudItemHandler } from '@/lib/api/crud'
import { safeString } from '@/lib/security/schemas'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const UpdateSchema = z.object({
  metric_type: z.enum(['tam', 'sam', 'som', 'growth_rate', 'penetration', 'share', 'competitor_count', 'arpu', 'market_size']).optional(),
  region: safeString.optional(),
  segment: safeString.optional(),
  value_numeric: z.number().optional(),
  value_unit: safeString.optional(),
  currency: safeString.optional(),
  period_start: safeString.optional(),
  period_end: safeString.optional(),
  source: safeString.optional(),
  source_url: safeString.optional(),
  confidence: z.enum(['low', 'medium', 'high', 'verified']).optional(),
  notes: safeString.optional(),
})

export const { GET, PATCH, DELETE } = createCrudItemHandler({ table: 'market_data', updateSchema: UpdateSchema })
