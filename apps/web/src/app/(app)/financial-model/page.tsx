import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { FinancialModelStudio } from './studio'

export const dynamic = 'force-dynamic'

export default async function FinancialModelPage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirect=/financial-model')

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <header className="mb-6">
        <div className="text-xs uppercase tracking-widest text-ink-dim">Tài chính › Financial Model</div>
        <h1 className="font-serif text-2xl text-gold-light mt-1">Mô hình tài chính · Monte Carlo</h1>
        <p className="text-sm text-ink-dim mt-1">
          1.000 kịch bản · runway radar · sensitivity. Biết trước còn sống được bao lâu &amp; khi nào cần gọi vốn.
        </p>
      </header>
      <FinancialModelStudio />
    </div>
  )
}
