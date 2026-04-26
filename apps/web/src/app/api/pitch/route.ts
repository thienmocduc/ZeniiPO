import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { requireUserAndTenant } from '@/lib/api/tenant'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Pitch decks live as data_room_docs in a "pitch-decks" folder convention.
export async function GET() {
  const supabase = await createServerClient()
  const auth = await requireUserAndTenant(supabase)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: 500 })
  }
  // Find pitch folders by name match
  const { data: folders } = await supabase
    .from('data_room_folders')
    .select('id, name')
    .ilike('name', '%pitch%')
  const folderIds = (folders ?? []).map((f) => f.id)
  let docs: unknown[] = []
  if (folderIds.length > 0) {
    const { data, error } = await supabase
      .from('data_room_docs')
      .select('id, title, storage_path, folder_id, created_at')
      .in('folder_id', folderIds)
      .order('created_at', { ascending: false })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    docs = data ?? []
  }
  return NextResponse.json({ data: { folders: folders ?? [], decks: docs } })
}
