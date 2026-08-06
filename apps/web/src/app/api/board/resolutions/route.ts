import { z } from 'zod'
import { createCrudHandler } from '@/lib/api/crud'
import { safeString } from '@/lib/security/schemas'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Nghị quyết HĐQT — hồ sơ quản trị bắt buộc cho due-diligence + IPO.
 * Mỗi quyết định lớn (gọi vốn, ESOP, bổ nhiệm, ngân sách, M&A) phải có
 * nghị quyết ký; thiếu là mất điểm ở IPO readiness mảng governance.
 */
const Schema = z.object({
  title: safeString.min(1),
  body: safeString.optional(),
  resolution_no: safeString.optional(),
  meeting_date: safeString.optional(),
  resolution_type: z
    .enum(['funding', 'esop', 'appointment', 'budget', 'm_and_a', 'policy', 'audit', 'ipo', 'other'])
    .default('other'),
  status: z.enum(['draft', 'voted', 'approved', 'rejected', 'executed']).default('draft'),
  votes_for: z.number().int().min(0).max(1000).optional(),
  votes_against: z.number().int().min(0).max(1000).optional(),
  votes_abstain: z.number().int().min(0).max(1000).optional(),
})

export const { GET, POST } = createCrudHandler({
  table: 'board_resolutions',
  orderBy: 'meeting_date',
  searchableColumns: ['status', 'resolution_type'],
  createSchema: Schema,
})
