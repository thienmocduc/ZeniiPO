import { NextResponse } from 'next/server'
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
