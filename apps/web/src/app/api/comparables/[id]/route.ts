import { z } from 'zod'
import { createCrudItemHandler } from '@/lib/api/crud'
import { safeString } from '@/lib/security/schemas'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const UpdateSchema = z.object({
  company_name: safeString.min(1).optional(),
  ticker: safeString.optional(),
  exchange: safeString.optional(),
  industry: safeString.optional(),
  region: safeString.optional(),
  revenue_usd: z.number().optional(),
  ebitda_usd: z.number().optional(),
  market_cap_usd: z.number().optional(),
  enterprise_value_usd: z.number().optional(),
  ev_revenue_multiple: z.number().optional(),
  ev_ebitda_multiple: z.number().optional(),
  pe_ratio: z.number().optional(),
  growth_rate_pct: z.number().optional(),
  notes: safeString.optional(),
})

export const { GET, PATCH, DELETE } = createCrudItemHandler({ table: 'comparables', updateSchema: UpdateSchema })
