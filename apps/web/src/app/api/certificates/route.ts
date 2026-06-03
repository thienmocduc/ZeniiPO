import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { requireUserAndTenant } from '@/lib/api/tenant'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// GET — issue any newly-earned certs (idempotent) then return all certs.
export async function GET() {
  const supabase = await createServerClient()
  const auth = await requireUserAndTenant(supabase)
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status })

  await supabase.rpc('issue_certificates', { p_tenant_id: auth.tenantId })

  const { data, error } = await supabase
    .from('certificates')
    .select('*')
    .eq('tenant_id', auth.tenantId)
    .order('issued_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
