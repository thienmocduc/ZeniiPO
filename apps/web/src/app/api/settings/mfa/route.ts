import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * MFA/TOTP trước đây chạy trên Supabase Auth (đã thu hồi). Tài khoản giờ là
 * Zeni ID (Lớp 5) — MFA quản lý ở tầng nền tảng; app sẽ bật lại khi Zeni ID
 * expose API MFA. Fail-closed: trả 501 rõ ràng, không giả lập.
 */
const NOT_READY = {
  error: 'MFA đã chuyển sang Zeni ID (Lớp 5). Quản lý bảo mật tài khoản tại zenicloud.io — app sẽ bật lại khi nền tảng mở API MFA.',
}

async function requireUser() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function GET() {
  const user = await requireUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  // Danh sách factor rỗng — để UI hiện trạng thái "chưa bật" thay vì crash.
  return NextResponse.json({ data: { totp: [], all: [] }, notice: NOT_READY.error })
}

export async function POST() {
  const user = await requireUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return NextResponse.json(NOT_READY, { status: 501 })
}

export async function PATCH() {
  const user = await requireUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return NextResponse.json(NOT_READY, { status: 501 })
}

export async function DELETE() {
  const user = await requireUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return NextResponse.json(NOT_READY, { status: 501 })
}
