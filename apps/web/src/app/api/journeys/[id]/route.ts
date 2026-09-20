import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase/server'
import { safeString, safeUuid } from '@/lib/security/schemas'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * ⚠ `title` KHÔNG phải cột của `ipo_journeys` — cột tên là `name`. Bản cũ khai
 * cả hai rồi đẩy thẳng `parsed.data` vào UPDATE, nên ai gửi `title` là nhận
 * lỗi 500 từ CSDL. Và `status` nhận chuỗi bất kỳ trong khi bảng có ràng buộc
 * chỉ cho bốn giá trị — gửi giá trị khác cũng đổ ở CSDL chứ không được báo
 * lỗi tử tế ở cửa vào.
 */
const TRANG_THAI_HANH_TRINH = ['active', 'paused', 'completed', 'abandoned'] as const

const UpdateSchema = z.object({
  name: safeString.min(1).optional(),
  status: z.enum(TRANG_THAI_HANH_TRINH).optional(),
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
    .from('ipo_journeys')
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
    .from('ipo_journeys')
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

  const { error } = await supabase.from('ipo_journeys').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data: { id } })
}
