import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase/server'
import { requireUserAndTenant } from '@/lib/api/tenant'
import { TARGET_TABLES } from '@/lib/connectors/ingest'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Ánh xạ cột nguồn → bảng chuẩn Zeni cho một connector.
 * Cùng 1 connector có thể có nhiều nguồn (nhiều sheet/bảng) đổ về nhiều bảng đích.
 */

const PostSchema = z.object({
  source_object: z.string().trim().min(1).max(200),
  target_table: z.enum(TARGET_TABLES),
  field_map: z.record(z.string().max(120)).default({}),
  dedupe_keys: z.array(z.string().max(64)).max(5).optional(),
})

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: 'Invalid connector id' }, { status: 400 })
  }

  const supabase = await createServerClient()
  const auth = await requireUserAndTenant(supabase)
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status })

  const body = await req.json().catch(() => ({}))
  const parsed = PostSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  // RLS đã giới hạn theo tenant; kiểm tra tồn tại để trả 404 rõ ràng.
  const { data: conn } = await supabase.from('data_connectors').select('id').eq('id', id).maybeSingle()
  if (!conn) return NextResponse.json({ error: 'Connector không tồn tại' }, { status: 404 })

  const { data, error } = await supabase
    .from('connector_mappings')
    .insert({ tenant_id: auth.tenantId, connector_id: id, ...parsed.data })
    .select('id, source_object, target_table, field_map')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}
