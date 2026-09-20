import { NextResponse } from 'next/server'
import { z } from 'zod'
import { SoTienDuong } from '@/lib/tien/so-tien'
import { createServerClient } from '@/lib/supabase/server'
import { safeString, safeUuid } from '@/lib/security/schemas'
import { notifyRoundClosed } from '@/lib/notify/slack'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * ⚠ NĂM THỨ SAI, endpoint này chưa bao giờ sửa được một vòng gọi vốn nào:
 *   name                → round_name
 *   target_amount       → target_raise_usd
 *   pre_money_valuation → pre_money_usd
 *   expected_close_at   → target_close_date
 * và tập trạng thái cũ ('dd', 'closing') KHÔNG có trong ràng buộc của CSDL,
 * trong khi 'negotiating', 'due_diligence', 'signed', 'wired', 'failed' thì
 * không cách nào đặt được. Danh sách dưới chép đúng ràng buộc
 * `fundraise_rounds_status_check`.
 */
const STATUSES = [
  'planning', 'outreach', 'negotiating', 'term_sheet',
  'due_diligence', 'signed', 'wired', 'closed', 'failed',
] as const

const UpdateSchema = z.object({
  round_name: safeString.min(1).optional(),
  status: z.enum(STATUSES).optional(),
  /** ĐÔ LA NGUYÊN (cột CSDL là bigint). */
  target_raise_usd: SoTienDuong.optional(),
  pre_money_usd: SoTienDuong.optional(),
  /** Ngày dự kiến chốt, dạng YYYY-MM-DD. */
  target_close_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày dạng YYYY-MM-DD').optional(),
})

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const idCheck = safeUuid.safeParse(id)
  if (!idCheck.success) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
  }

  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('fundraise_rounds')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ data })
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const idCheck = safeUuid.safeParse(id)
  if (!idCheck.success) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
  }

  const body = await req.json().catch(() => ({}))
  const parsed = UpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('fundraise_rounds')
    .update(parsed.data)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Slack notification when status flips to 'closed' (no-op if webhook missing).
  if (parsed.data.status === 'closed' && data) {
    const { data: tenant } = await supabase
      .from('tenants')
      .select('name')
      .eq('id', data.tenant_id)
      .maybeSingle()
    await notifyRoundClosed({
      tenant_name: tenant?.name ?? 'Unknown tenant',
      round_name: data.round_name ?? data.round_code ?? 'Round',
      amount_usd: Number(data.target_raise_usd ?? data.committed_usd ?? 0),
      pre_money_usd: data.pre_money_usd ? Number(data.pre_money_usd) : null,
      post_money_usd: data.post_money_usd ? Number(data.post_money_usd) : null,
    })
  }

  return NextResponse.json({ data })
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const idCheck = safeUuid.safeParse(id)
  if (!idCheck.success) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
  }

  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabase.from('fundraise_rounds').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data: { id } })
}
