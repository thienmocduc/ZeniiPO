import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { PlanStudio } from './plan-studio'

export const dynamic = 'force-dynamic'

export default async function PlanPage() {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirect=/plan')

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <header className="mb-6">
        <div className="text-xs uppercase tracking-widest text-ink-dim">Tài chính › Kế hoạch</div>
        <h1 className="font-serif text-2xl text-gold-light mt-1">Kế hoạch tài chính · ba báo cáo</h1>
        <p className="text-sm text-ink-dim mt-1 max-w-3xl">
          Nơi biến giả định kinh doanh thành lãi lỗ, lưu chuyển tiền và bảng cân đối theo tháng —
          rồi chốt thành chỉ tiêu gửi sang ZeniOS và ZeniERP. Bản đã chốt khoá vĩnh viễn để nhà
          đầu tư đối chiếu &quot;hứa&quot; với &quot;làm&quot;.
        </p>
      </header>
      <PlanStudio />
    </div>
  )
}
