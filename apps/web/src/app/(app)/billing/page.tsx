import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { BangGoi } from './bang-goi'

export const dynamic = 'force-dynamic'

export default async function BillingPage() {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirect=/billing')

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <header className="mb-6">
        <div className="text-xs uppercase tracking-widest text-ink-dim">Tài khoản › Gói dịch vụ</div>
        <h1 className="font-serif text-2xl text-gold-light mt-1">Gói dịch vụ &amp; hạn mức</h1>
        <p className="text-sm text-ink-dim mt-1 max-w-3xl">
          Gói đang dùng, mức đã dùng so với hạn mức, và các gói cao hơn.
        </p>
      </header>
      <BangGoi />
    </div>
  )
}
