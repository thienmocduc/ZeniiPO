import { z } from 'zod'
import { createCrudItemHandler } from '@/lib/api/crud'
import { safeString } from '@/lib/security/schemas'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const Money = z.number().finite().min(-1e15).max(1e15)
const UpdateSchema = z.object({
  phase: z.number().int().min(1).max(10).optional(),
  revenue_target: Money.optional(),
  gross_margin_target_pct: z.number().min(-100).max(100).optional(),
  ebitda_target: Money.optional(),
  headcount_target: z.number().int().min(0).max(1_000_000).optional(),
  funding_target: Money.optional(),
  funding_round_code: safeString.optional(),
  valuation_target: Money.optional(),
  key_milestone: safeString.optional(),
  notes: safeString.optional(),
})

export const { GET, PATCH, DELETE } = createCrudItemHandler({
  table: 'masterplan_years',
  updateSchema: UpdateSchema,
})
