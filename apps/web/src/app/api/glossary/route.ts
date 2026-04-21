import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { safeString } from '@/lib/security/sanitize'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Public read — no auth required. Searchable via ?q=
export async function GET(req: Request) {
  const supabase = createServerClient()
  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')?.trim() ?? ''

  let query = supabase.from('glossary').select('*')

  if (q) {
    const qCheck = safeString.safeParse(q)
    if (!qCheck.success) {
      return NextResponse.json({ error: 'Invalid query' }, { status: 400 })
    }
    // Basic ILIKE search across term/definition. Escape % and _ to keep LIKE literal.
    const safe = qCheck.data.replace(/[%_]/g, '\\$&')
    query = query.or(`term.ilike.%${safe}%,definition_vi.ilike.%${safe}%,definition_en.ilike.%${safe}%`)
  }

  const { data, error } = await query.order('term', { ascending: true }).limit(200)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
