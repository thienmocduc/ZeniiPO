import { z } from 'zod'
import { createCrudHandler } from '@/lib/api/crud'
import { safeString } from '@/lib/security/schemas'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const Schema = z.object({
  category: z.enum(['competitor','regulation','market_shift','customer_signal','tech_trend','m_and_a','funding_round','exit']),
  severity: z.enum(['info','watch','alert','critical']).optional(),
  title: safeString.min(1),
  body: safeString.optional(),
  source_url: safeString.optional(),
  published_at: safeString.optional(),
  related_competitor: safeString.optional(),
  region: safeString.optional(),
  industry: safeString.optional(),
})

export const { GET, POST } = createCrudHandler({
  table: 'market_intel',
  orderBy: 'created_at',
  searchableColumns: ['category', 'severity'],
  createSchema: Schema,
})
