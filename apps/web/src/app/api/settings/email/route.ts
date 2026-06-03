import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const Schema = z.object({
  new_email: z.string().email(),
})

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const parsed = Schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const upd = await supabase.auth.updateUser({ email: parsed.data.new_email })
  if (upd.error) {
    return NextResponse.json({ error: upd.error.message }, { status: 400 })
  }
  // Supabase sends confirmation email to BOTH old + new. User must click both links.
  return NextResponse.json({
    data: {
      ok: true,
      message: 'Confirm link đã gửi tới cả email cũ và mới. Click cả 2 link để hoàn tất đổi.',
    },
  })
}
