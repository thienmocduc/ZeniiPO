import { z } from 'zod'
import { createCrudHandler } from '@/lib/api/crud'
import { safeString } from '@/lib/security/schemas'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const Schema = z.object({
  token_symbol: safeString.min(1).max(20),
  pool_name: safeString.min(1),
  allocation_pct: z.number().min(0).max(100),
  total_supply: z.number().optional(),
  vesting_start: safeString.optional(),
  vesting_cliff_months: z.number().int().optional(),
  vesting_duration_months: z.number().int().optional(),
  vested_amount: z.number().optional(),
  notes: safeString.optional(),
  contract_address: safeString.optional(),
  blockchain: safeString.optional(),
})

export const { GET, POST } = createCrudHandler({
  table: 'tokenomics_allocations',
  searchableColumns: ['token_symbol', 'blockchain'],
  createSchema: Schema,
})
