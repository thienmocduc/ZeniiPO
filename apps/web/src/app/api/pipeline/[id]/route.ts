import { NextResponse } from 'next/server'
import { z } from 'zod'
import { SoTien } from '@/lib/tien/so-tien'
import { createServerClient } from '@/lib/supabase/server'
import { safeString, safeUuid } from '@/lib/security/schemas'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * ⚠ `check_size` KHÔNG phải cột của `investor_pipeline` — cột thật là
 * `target_check_usd`. Bản cũ đẩy thẳng `parsed.data` vào UPDATE nên mọi lần
 * sửa quy mô khoản đầu tư đều trả lỗi 500.
 */
const UpdateSchema = z.object({
  stage: z.enum(['outreach', 'intro', 'meeting', 'pitch', 'follow_up', 'term_sheet', 'due_diligence', 'signed', 'wired', 'closed', 'passed', 'ghosted']).optional(),
  /** Quy mô khoản dự kiến, ĐÔ LA NGUYÊN (cột CSDL là bigint). */
  target_check_usd: SoTien.optional(),
  committed_usd: SoTien.optional(),
  notes: safeString.optional(),
  investor_name: safeString.min(1).optional(),
})

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
    .from('investor_pipeline')
    .update(parsed.data)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
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

  const { error } = await supabase.from('investor_pipeline').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data: { id } })
}
