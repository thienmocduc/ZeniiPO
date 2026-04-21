import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  const supabase = createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [configured, catalog] = await Promise.all([
    supabase.from('agents').select('*').order('created_at', { ascending: false }),
    supabase.from('agent_catalog').select('*').order('name', { ascending: true }),
  ])

  if (configured.error) {
    return NextResponse.json({ error: configured.error.message }, { status: 500 })
  }
  if (catalog.error) {
    return NextResponse.json({ error: catalog.error.message }, { status: 500 })
  }

  return NextResponse.json({
    data: { configured: configured.data, catalog: catalog.data },
  })
}
