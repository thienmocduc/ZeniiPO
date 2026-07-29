import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase/server'
import { requireUserAndTenant } from '@/lib/api/tenant'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const BLOCK_KEYS = [
  'customer_segments',
  'value_propositions',
  'channels',
  'customer_relationships',
  'revenue_streams',
  'key_resources',
  'key_activities',
  'key_partnerships',
  'cost_structure',
] as const

/** GET /api/canvas — 9 khối BMC của tenant (khối trống trả items []). */
export async function GET() {
  const supabase = await createServerClient()
  const auth = await requireUserAndTenant(supabase)
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status })

  const { data, error } = await supabase
    .from('canvas_blocks')
    .select('block_key, items, updated_at')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const byKey = new Map((data ?? []).map((b) => [b.block_key as string, b]))
  const blocks = BLOCK_KEYS.map((k) => ({
    block_key: k,
    items: (byKey.get(k)?.items as string[] | undefined) ?? [],
    updated_at: byKey.get(k)?.updated_at ?? null,
  }))
  return NextResponse.json({ data: { blocks } })
}

const PostSchema = z.object({
  block_key: z.enum(BLOCK_KEYS),
  items: z.array(z.string().trim().min(1).max(300)).max(20),
})

/** POST /api/canvas — upsert một khối BMC. */
export async function POST(req: Request) {
  const supabase = await createServerClient()
  const auth = await requireUserAndTenant(supabase)
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status })

  const body = await req.json().catch(() => ({}))
  const parsed = PostSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { data, error } = await supabase
    .from('canvas_blocks')
    .upsert(
      { tenant_id: auth.tenantId, block_key: parsed.data.block_key, items: parsed.data.items },
      { onConflict: 'tenant_id,block_key' },
    )
    .select('block_key, items')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}
