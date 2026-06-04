import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { ConsoleView } from '@/components/console-view'

export const dynamic = 'force-dynamic'

/**
 * Zeni Console — platform operator + holdings cockpit.
 * Server guard: chairman_super only. Non-super users are bounced to /dashboard
 * (defence-in-depth on top of the /api/console 403 + middleware auth gate).
 */
export default async function ConsolePage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: isSuper } = await supabase.rpc('is_chairman_super')
  if (!isSuper) redirect('/dashboard')
  return <ConsoleView />
}
