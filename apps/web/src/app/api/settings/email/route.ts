import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Email tài khoản thuộc Zeni ID (Lớp 5) — đổi tại zenicloud.io → Account.
 * Fail-closed 501 cho tới khi Zeni ID mở API (backend Supabase cũ đã thu hồi).
 */
export async function POST() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  return NextResponse.json(
    {
      error:
        'Email tài khoản quản lý tại Zeni ID (tài khoản hệ sinh thái) — đổi tại zenicloud.io → Account. App sẽ bật lại khi Zeni ID mở API.',
    },
    { status: 501 },
  )
}
