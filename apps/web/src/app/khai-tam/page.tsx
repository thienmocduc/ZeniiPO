import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { KhaiTamFlow } from './flow'

export const dynamic = 'force-dynamic'

export default async function KhaiTamPage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirect=/khai-tam')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('tenant_id, full_name')
    .eq('id', user.id)
    .maybeSingle()
  if (!profile?.tenant_id) redirect('/login?error=no_tenant')

  return (
    <main className="relative min-h-screen w-full bg-bg text-ink">
      <div className="mx-auto max-w-3xl px-6 py-10">
        <header className="mb-8 text-center">
          <div className="text-xs uppercase tracking-[0.28em] text-gold-light font-semibold mb-2">
            Cấp 1 · Gốc · Khai Tâm
          </div>
          <h1 className="font-serif text-3xl text-ink">Hiểu cơ chế vốn</h1>
          <p className="text-sm text-ink-dim mt-2 max-w-xl mx-auto">
            Chào {profile.full_name ?? 'bạn'} — 6 bài ngắn bằng ngôn ngữ đời thường, một bài thi,
            rồi bạn dựng cap table thật của chính mình. Học xong = đã có dữ liệu vận hành.
          </p>
        </header>
        <KhaiTamFlow />
      </div>
    </main>
  )
}
