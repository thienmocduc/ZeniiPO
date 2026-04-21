import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { safeUuid } from '@/lib/security/schemas'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ 'drill-id': string }> },
) {
  const { 'drill-id': drillId } = await params
  const idCheck = safeUuid.safeParse(drillId)
  if (!idCheck.success) {
    return NextResponse.json({ error: 'Invalid drill id' }, { status: 400 })
  }

  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Verify drill exists + access
  const { data: drill } = await supabase
    .from('training_drills')
    .select('*')
    .eq('id', drillId)
    .maybeSingle()

  if (!drill) return NextResponse.json({ error: 'Drill not found' }, { status: 404 })

  const { data: hasAccess } = await supabase.rpc('has_academy_access', {
    content_type: 'drill',
    content_id: drillId,
  })
  if (hasAccess === false) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 })
  }

  const { data, error } = await supabase
    .from('academy_progress')
    .upsert(
      {
        user_id: user.id,
        content_type: 'drill',
        content_id: drillId,
        status: 'certified',
        progress_pct: 100,
        completed_at: new Date().toISOString(),
        cert_issued_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,content_type,content_id' },
    )
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}
