import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { PhongHopHoiDong } from './phong-hop'

export const dynamic = 'force-dynamic'

export default async function BoardPage() {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirect=/board')

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <header className="mb-6">
        <div className="text-xs uppercase tracking-widest text-ink-dim">Quản trị công ty</div>
        <h1 className="font-serif text-2xl text-gold-light mt-1">Hội đồng quản trị</h1>
        <p className="text-sm text-ink-dim mt-1 max-w-3xl">
          Lập hội đồng, mở phiên họp trực tiếp hoặc trực tuyến, lưu biên bản, và ra nghị quyết có
          hiệu lực. <strong className="text-ink">Túc số do hệ thống tính từ điểm danh thật</strong> —
          không có ô nào để khai &ldquo;đã đủ túc số&rdquo;, vì nghị quyết thiếu túc số thì vô hiệu.
          Nghị quyết đã thông qua mới phân phối được xuống từng ghế trong sơ đồ tổ chức.
        </p>
      </header>
      <PhongHopHoiDong />
    </div>
  )
}
