import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase/server'
import { requireUserAndTenant } from '@/lib/api/tenant'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: Request) {
  const supabase = await createServerClient()
  const auth = await requireUserAndTenant(supabase)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status })
  }
  const url = new URL(req.url)
  const folderId = url.searchParams.get('folder_id')
  const [folders, docs] = await Promise.all([
    supabase
      .from('data_room_folders')
      .select('id, name, parent_id, created_at')
      .order('name', { ascending: true }),
    folderId
      ? supabase
          .from('data_room_docs')
          .select('id, title, storage_path, mime_type, file_size_bytes, folder_id, created_at')
          .eq('folder_id', folderId)
          .order('created_at', { ascending: false })
      : supabase
          .from('data_room_docs')
          .select('id, title, storage_path, mime_type, file_size_bytes, folder_id, created_at')
          .order('created_at', { ascending: false })
          .limit(100),
  ])
  if (folders.error) return NextResponse.json({ error: folders.error.message }, { status: 500 })
  if (docs.error) return NextResponse.json({ error: docs.error.message }, { status: 500 })
  return NextResponse.json({ data: { folders: folders.data ?? [], docs: docs.data ?? [] } })
}

const CreateFolderSchema = z.object({
  name: z.string().trim().min(1).max(120),
  parent_id: z.string().uuid().optional(),
})

/** POST /api/vault — create a data-room folder (docs upload flow lands later). */
export async function POST(req: Request) {
  const supabase = await createServerClient()
  const auth = await requireUserAndTenant(supabase)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status })
  }
  const body = await req.json().catch(() => ({}))
  const parsed = CreateFolderSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  const { data, error } = await supabase
    .from('data_room_folders')
    .insert({ ...parsed.data, tenant_id: auth.tenantId })
    .select('id, name, parent_id, created_at')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}
