import { z } from 'zod'
import { createCrudItemHandler } from '@/lib/api/crud'
import { safeString } from '@/lib/security/schemas'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const UpdateSchema = z.object({
  metric_code: safeString.min(1).optional(),
  name: safeString.min(1).optional(),
  value: z.number().optional(),
  unit: safeString.optional(),
  period: safeString.optional(),
  trend: safeString.optional(),
})

export const { GET, PATCH, DELETE } = createCrudItemHandler({ table: 'kpi_metrics', updateSchema: UpdateSchema })
