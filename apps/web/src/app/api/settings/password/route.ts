import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Đổi mật khẩu giờ thuộc Zeni ID (Lớp 5) — tài khoản hệ sinh thái dùng chung,
 * app không giữ mật khẩu (backend Supabase cũ đã thu hồi). Fail-closed 501,
 * chỉ đường sang zenicloud.io; bật lại khi Zeni ID mở API đổi mật khẩu.
 */
export async function POST() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  return NextResponse.json(
    {
      error:
        'Mật khẩu quản lý tại Zeni ID (tài khoản hệ sinh thái) — đổi tại zenicloud.io → Account. App sẽ bật lại khi Zeni ID mở API.',
    },
    { status: 501 },
  )
}
