import { z } from 'zod'
import { SoTien } from '@/lib/tien/so-tien'
import { createCrudHandler } from '@/lib/api/crud'
import { safeString } from '@/lib/security/schemas'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const Schema = z.object({
  company_name: safeString.min(1),
  ticker: safeString.optional(),
  exchange: safeString.optional(),
  industry: safeString.optional(),
  region: safeString.optional(),
  revenue_usd: SoTien.optional(),
  ebitda_usd: SoTien.optional(),
  market_cap_usd: SoTien.optional(),
  enterprise_value_usd: SoTien.optional(),
  ev_revenue_multiple: z.number().optional(),
  ev_ebitda_multiple: z.number().optional(),
  pe_ratio: z.number().optional(),
  growth_rate_pct: z.number().optional(),
  notes: safeString.optional(),
  data_source: safeString.optional(),
  data_as_of: safeString.optional(),
})

export const { GET, POST } = createCrudHandler({
  table: 'comparables',
  searchableColumns: ['industry', 'region', 'exchange'],
  createSchema: Schema,
})
