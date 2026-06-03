import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { JourneyMap } from './journey-map'

export const dynamic = 'force-dynamic'

export default async function JourneyPage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirect=/journey')

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <header className="mb-8 text-center">
        <div className="text-xs uppercase tracking-[0.28em] text-gold-light font-semibold mb-3">
          Hành trình 0 → Rung chuông
        </div>
        <h1 className="font-serif text-3xl text-ink">
          Một hành trình, <span className="text-gold-light">bảy tầng năng lượng.</span>
        </h1>
        <p className="text-sm text-ink-dim mt-2 max-w-2xl mx-auto">
          Hệ thống biết bạn đang ở chặng nào, mở khoá đúng công cụ cho chặng đó — học bằng dữ liệu thật,
          qua cổng KPI mới lên chặng kế.
        </p>
      </header>
      <JourneyMap />
    </div>
  )
}
