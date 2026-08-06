import { z } from 'zod'
import { createCrudItemHandler } from '@/lib/api/crud'
import { safeString } from '@/lib/security/schemas'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const UpdateSchema = z.object({
  name: safeString.optional(),
  status: z.enum(['active', 'paused', 'error', 'pending_setup']).optional(),
  direction: z.enum(['inbound', 'outbound', 'bidirectional']).optional(),
})

export const { GET, PATCH, DELETE } = createCrudItemHandler({
  table: 'data_connectors',
  updateSchema: UpdateSchema,
})
