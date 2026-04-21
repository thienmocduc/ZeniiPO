import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { safeUuid } from '@/lib/security/schemas'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: Request) {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const accessId = searchParams.get('access_id')

  let query = supabase.from('dd_access_logs').select('*')
  if (accessId) {
    const idCheck = safeUuid.safeParse(accessId)
    if (!idCheck.success) {
      return NextResponse.json({ error: 'Invalid access_id' }, { status: 400 })
    }
    query = query.eq('access_id', accessId)
  }

  const { data, error } = await query.order('created_at', { ascending: false }).limit(500)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
