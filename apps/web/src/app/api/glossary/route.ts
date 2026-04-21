import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Public read — no auth required. Searchable via ?q=
export async function GET(req: NextRequest) {
  try {
    const supabase = await createServerClient()
    const q = req.nextUrl.searchParams.get('q')?.trim() ?? ''

    let query = supabase.from('glossary').select('*')

    if (q && /^[\w\s-]+$/.test(q) && q.length <= 100) {
      // Basic safety: only allow alphanum + space + dash to prevent injection patterns
      const safe = q.replace(/[%_]/g, '\\$&')
      query = query.or(
        `term.ilike.%${safe}%,definition_vi.ilike.%${safe}%,definition_en.ilike.%${safe}%`,
      )
    }

    const { data, error } = await query.order('term', { ascending: true }).limit(200)
    if (error) {
      console.error('[glossary] query error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ data })
  } catch (err) {
    console.error('[glossary] handler exception:', err)
    const message = err instanceof Error ? err.message : 'Internal error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
