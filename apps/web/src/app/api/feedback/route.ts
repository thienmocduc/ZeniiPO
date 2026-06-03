import { z } from 'zod'
import { createCrudHandler } from '@/lib/api/crud'
import { safeString } from '@/lib/security/schemas'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const Schema = z.object({
  category: z.enum(['bug','feature_request','ux','data_quality','performance','other']).default('other'),
  severity: z.enum(['low','medium','high','critical']).default('medium'),
  page_path: safeString.optional(),
  title: safeString.min(1),
  body: safeString.optional(),
})

export const { GET, POST } = createCrudHandler({
  table: 'feedback_items',
  searchableColumns: ['status', 'category', 'severity'],
  createSchema: Schema,
  beforeInsert: (payload, { userId }) => ({ ...payload, submitted_by: userId }),
})
