import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// PUBLIC cert verification — anyone with a code can check authenticity.
// No auth required (it's a public credential), but we still rate-limit via
// middleware and validate the code shape.
const Schema = z.object({ code: z.string().trim().min(4).max(20) })

export async function GET(req: Request) {
  const url = new URL(req.url)
  const parsed = Schema.safeParse({ code: url.searchParams.get('code') ?? '' })
  if (!parsed.success) return NextResponse.json({ error: 'Invalid code' }, { status: 400 })

  const supabase = await createServerClient()
  const { data, error } = await supabase.rpc('verify_certificate', { p_code: parsed.data.code })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
