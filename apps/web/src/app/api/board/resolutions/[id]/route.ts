import { z } from 'zod'
import { createCrudItemHandler } from '@/lib/api/crud'
import { safeString } from '@/lib/security/schemas'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const UpdateSchema = z.object({
  title: safeString.optional(),
  body: safeString.optional(),
  resolution_no: safeString.optional(),
  meeting_date: safeString.optional(),
  status: z.enum(['draft', 'voted', 'approved', 'rejected', 'executed']).optional(),
  votes_for: z.number().int().min(0).max(1000).optional(),
  votes_against: z.number().int().min(0).max(1000).optional(),
  votes_abstain: z.number().int().min(0).max(1000).optional(),
})

export const { GET, PATCH, DELETE } = createCrudItemHandler({
  table: 'board_resolutions',
  updateSchema: UpdateSchema,
})
