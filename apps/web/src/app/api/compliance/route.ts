import { z } from 'zod'
import { createCrudHandler } from '@/lib/api/crud'
import { safeString } from '@/lib/security/schemas'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Sổ đăng ký tuân thủ — giấy phép · hợp đồng · IP · thuế · lao động · filing.
 * DD pháp lý soi đúng bảng này; item hết hạn = rủi ro đỏ khi IPO.
 */
const Schema = z.object({
  item_type: z.enum(['license', 'contract', 'ip', 'tax', 'labor', 'filing', 'insurance', 'policy', 'other']),
  title: safeString.min(1),
  authority: safeString.optional(),
  reference_no: safeString.optional(),
  issued_date: safeString.optional(),
  expiry_date: safeString.optional(),
  status: z.enum(['active', 'expiring', 'expired', 'pending', 'revoked']).default('active'),
  notes: safeString.optional(),
})

export const { GET, POST } = createCrudHandler({
  table: 'compliance_items',
  orderBy: 'expiry_date',
  searchableColumns: ['item_type', 'status'],
  createSchema: Schema,
})
