import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase/server'
import { safeString, safeUuid } from '@/lib/security/sanitize'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const MarkSchema = z.object({
  content_type: safeString.min(1),
  content_id: safeUuid,
  status: safeString.optional(),
  progress_pct: z.number().min(0).max(100).optional(),
})

export async function GET() {
  const supabase = createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('academy_progress')
    .select('*')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const parsed = MarkSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const supabase = createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Access gate
  const { data: hasAccess } = await supabase.rpc('has_academy_access', {
    content_type: parsed.data.content_type,
    content_id: parsed.data.content_id,
  })
  if (hasAccess === false) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 })
  }

  const payload = {
    user_id: user.id,
    content_type: parsed.data.content_type,
    content_id: parsed.data.content_id,
    status: parsed.data.status ?? 'completed',
    progress_pct: parsed.data.progress_pct ?? 100,
    completed_at: (parsed.data.status ?? 'completed') === 'completed' ? new Date().toISOString() : null,
  }

  const { data, error } = await supabase
    .from('academy_progress')
    .upsert(payload, { onConflict: 'user_id,content_type,content_id' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}
