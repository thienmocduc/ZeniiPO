import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const Schema = z.object({
  new_email: z.string().email(),
})

export async function POST(req: Request) {
  // Auth gate FIRST.
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const parsed = Schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const upd = await supabase.auth.updateUser({ email: parsed.data.new_email })
  if (upd.error) {
    return NextResponse.json({ error: upd.error.message }, { status: 400 })
  }
  return NextResponse.json({
    data: {
      ok: true,
      // Supabase sends confirm to BOTH old + new — user clicks both links.
      message: 'Confirm link đã gửi tới cả email cũ và mới. Click cả 2 link để hoàn tất đổi.',
    },
  })
}
