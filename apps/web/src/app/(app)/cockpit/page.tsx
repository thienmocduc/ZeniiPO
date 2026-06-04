import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { Cockpit } from './cockpit'

export const dynamic = 'force-dynamic'

export default async function CockpitPage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirect=/cockpit')

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <Cockpit />
    </div>
  )
}
