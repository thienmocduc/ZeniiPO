import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { OnboardingWizard } from './wizard'

export const dynamic = 'force-dynamic'

export default async function OnboardingPage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirect=/onboarding')

  // If tenant already has a journey, skip onboarding.
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('tenant_id, full_name, role')
    .eq('id', user.id)
    .maybeSingle()
  if (!profile?.tenant_id) redirect('/login?error=no_tenant')

  const { count } = await supabase
    .from('ipo_journeys')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', profile.tenant_id)
  if ((count ?? 0) > 0) redirect('/dashboard')

  const { data: tenant } = await supabase
    .from('tenants')
    .select('name, slug')
    .eq('id', profile.tenant_id)
    .maybeSingle()

  return (
    <main className="relative min-h-screen w-full bg-bg text-ink">
      <div className="mx-auto max-w-2xl px-6 py-12">
        <header className="mb-8 text-center">
          <h1 className="font-serif text-3xl text-gold-light">Khởi tạo hành trình IPO</h1>
          <p className="mt-2 text-sm text-ink-dim">
            Chào <strong className="text-ink">{profile.full_name ?? user.email}</strong> · {tenant?.name ?? 'Tenant'} ·
            {' '}3 bước thiết lập dữ liệu thật cho Phase 1.
          </p>
        </header>
        <OnboardingWizard />
      </div>
    </main>
  )
}
