import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const Schema = z.object({
  current_password: z.string().min(1),
  new_password: z.string().min(12, 'Mật khẩu mới phải ≥12 ký tự'),
})

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const parsed = Schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Re-authenticate with current password (Supabase requires this for sensitive update).
  const reauth = await supabase.auth.signInWithPassword({
    email: user.email,
    password: parsed.data.current_password,
  })
  if (reauth.error) {
    return NextResponse.json({ error: 'Mật khẩu hiện tại không đúng' }, { status: 403 })
  }

  const upd = await supabase.auth.updateUser({ password: parsed.data.new_password })
  if (upd.error) {
    return NextResponse.json({ error: upd.error.message }, { status: 400 })
  }
  return NextResponse.json({ data: { ok: true } })
}
