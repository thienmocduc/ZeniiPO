import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Public read — no auth required
export async function GET() {
  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('modules_catalog')
    .select('*')
    .eq('is_enabled', true)
    .order('display_order', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
