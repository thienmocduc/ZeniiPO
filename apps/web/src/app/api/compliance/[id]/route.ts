import { z } from 'zod'
import { createCrudItemHandler } from '@/lib/api/crud'
import { safeString } from '@/lib/security/schemas'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const UpdateSchema = z.object({
  title: safeString.optional(),
  authority: safeString.optional(),
  reference_no: safeString.optional(),
  issued_date: safeString.optional(),
  expiry_date: safeString.optional(),
  status: z.enum(['active', 'expiring', 'expired', 'pending', 'revoked']).optional(),
  notes: safeString.optional(),
})

export const { GET, PATCH, DELETE } = createCrudItemHandler({
  table: 'compliance_items',
  updateSchema: UpdateSchema,
})
