import { z } from 'zod'
import { createCrudItemHandler } from '@/lib/api/crud'
import { safeString } from '@/lib/security/schemas'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const UpdateSchema = z.object({
  token_symbol: safeString.min(1).max(20).optional(),
  pool_name: safeString.min(1).optional(),
  allocation_pct: z.number().min(0).max(100).optional(),
  total_supply: z.number().optional(),
  vesting_start: safeString.optional(),
  vesting_cliff_months: z.number().int().optional(),
  vesting_duration_months: z.number().int().optional(),
  vested_amount: z.number().optional(),
  notes: safeString.optional(),
  contract_address: safeString.optional(),
  blockchain: safeString.optional(),
})

export const { GET, PATCH, DELETE } = createCrudItemHandler({ table: 'tokenomics_allocations', updateSchema: UpdateSchema })
