import { z } from 'zod'
import { createCrudItemHandler } from '@/lib/api/crud'
import { safeString } from '@/lib/security/schemas'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const UpdateSchema = z.object({
  category: z.enum(['bug', 'feature_request', 'ux', 'data_quality', 'performance', 'other']).optional(),
  severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  status: safeString.optional(), // open → triaged → resolved (DB check validates)
  page_path: safeString.optional(),
  title: safeString.min(1).optional(),
  body: safeString.optional(),
})

export const { GET, PATCH, DELETE } = createCrudItemHandler({ table: 'feedback_items', updateSchema: UpdateSchema })
