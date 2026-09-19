import { z } from 'zod'
import { createCrudItemHandler } from '@/lib/api/crud'
import { safeString } from '@/lib/security/schemas'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const UpdateSchema = z.object({
  title_vi: safeString.optional(),
  purpose_vi: safeString.optional(),
  status: z.enum(['draft', 'active', 'deprecated']).optional(),
  frequency: z.enum(['daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'on_demand']).optional(),
  sla_hours: z.number().int().min(0).max(10_000).optional(),
  last_reviewed_at: safeString.optional(),
})

export const { GET, PATCH, DELETE } = createCrudItemHandler({
  table: 'sop_processes',
  updateSchema: UpdateSchema,
})
