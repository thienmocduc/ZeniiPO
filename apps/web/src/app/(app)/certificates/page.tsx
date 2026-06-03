import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { CertificateWall } from './wall'

export const dynamic = 'force-dynamic'

export default async function CertificatesPage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirect=/certificates')

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <header className="mb-8 text-center">
        <div className="text-xs uppercase tracking-[0.28em] text-gold-light font-semibold mb-2">Chứng nhận</div>
        <h1 className="font-serif text-3xl text-ink">Bằng chứng hành trình của bạn</h1>
        <p className="text-sm text-ink-dim mt-2 max-w-xl mx-auto">
          Mỗi cấp hoàn thành cấp một chứng nhận. Trọn 7 cấp → danh hiệu <b className="text-gold-light">IPO-Ready Founder</b>.
          Mỗi cert có mã verify công khai.
        </p>
      </header>
      <CertificateWall />
    </div>
  )
}
