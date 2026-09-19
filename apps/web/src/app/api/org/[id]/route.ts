import { z } from 'zod'
import { createCrudItemHandler } from '@/lib/api/crud'
import { safeString } from '@/lib/security/schemas'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const UpdateSchema = z.object({
  title_vi: safeString.optional(),
  holder_name: safeString.optional(),
  status: z.enum(['filled', 'open', 'planned', 'frozen']).optional(),
  level: z.enum(['c_level', 'director', 'manager', 'lead', 'ic']).optional(),
  target_hire_date: safeString.optional(),
})

export const { GET, PATCH, DELETE } = createCrudItemHandler({
  table: 'org_positions',
  updateSchema: UpdateSchema,
})
