import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase/server'
import { getCurrentTenantId } from '@/lib/api/tenant'
import { safeString, safeUuid } from '@/lib/security/schemas'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const CreateSchema = z.object({
  access_id: safeUuid.optional().nullable(),
  question: safeString.min(1),
  topic: safeString.optional(),
})

const UpdateSchema = z.object({
  id: safeUuid,
  answer: safeString.min(1).optional(),
  status: z.enum(['open', 'answered', 'closed']).optional(),
})

export async function GET() {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('dd_qa_threads')
    .select('*')
    .order('question_asked_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tenantId = await getCurrentTenantId(supabase, user.id)
  if (!tenantId) {
    return NextResponse.json({ error: 'No tenant for user' }, { status: 403 })
  }

  const { data, error } = await supabase
    .from('dd_qa_threads')
    .insert({
      // Khớp đúng cột `dd_qa_threads`. `topic` và `asked_by` KHÔNG có cột
      // tương ứng — người hỏi được suy ra từ `investor_access_id` (mỗi quyền
      // truy cập gắn với một nhà đầu tư), nên không cần lưu lại lần nữa.
      tenant_id: tenantId,
      investor_access_id: parsed.data.access_id,
      question: parsed.data.topic
        ? `[${parsed.data.topic}] ${parsed.data.question}`
        : parsed.data.question,
      status: 'open',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}

export async function PATCH(req: Request) {
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

  const { id, ...rest } = parsed.data
  const patch: Record<string, unknown> = { ...rest }
  if (patch.answer) {
    patch.answered_at = new Date().toISOString()
    patch.answered_by = user.id
    patch.status = patch.status ?? 'answered'
  }

  const { data, error } = await supabase
    .from('dd_qa_threads')
    .update(patch)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
